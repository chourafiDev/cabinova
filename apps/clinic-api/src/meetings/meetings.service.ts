import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import type { AddParticipantsDto, CreateMeetingDto } from './dto.js';
import { createEvent, deleteEvent, setAttendees } from './google.js';
import { GoogleConnectionService } from './google-connection.service.js';

const TZ = 'Africa/Casablanca';
/** "Now" may be a few minutes old by the time the form is sent. */
const PAST_GRACE_MS = 5 * 60_000;
/** The live strip also announces meetings about to start. */
const SOON_MS = 10 * 60_000;
const HISTORY_DAYS = 90;

type Person = { id: string; name: string; email: string; role: string };

export type MeetingStatus = 'upcoming' | 'live' | 'ended' | 'cancelled';

type MeetingRow = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  meetUrl: string;
  cancelledAt: Date | null;
  createdBy: { id: string; name: string } | null;
  participants: { id: string; name: string; role: string }[];
};

/** Who sees a meeting: the owner every one, the others theirs. */
const VISIBLE = `($1::uuid is null or m.created_by = $1 or exists (
  select 1 from meeting_participants p where p.meeting_id = m.id and p.user_id = $1))`;

const COLUMNS = `m.id, m.title, m.starts_at as "startsAt", m.ends_at as "endsAt",
  m.meet_url as "meetUrl", m.cancelled_at as "cancelledAt",
  case when c.id is null then null
       else json_build_object('id', c.id, 'name', c.name) end as "createdBy",
  coalesce((
    select json_agg(json_build_object('id', u.id, 'name', u.name, 'role', u.role) order by u.name)
      from meeting_participants p join users u on u.id = p.user_id
     where p.meeting_id = m.id), '[]') as participants`;

const statusOf = (m: MeetingRow, now = Date.now()): MeetingStatus =>
  m.cancelledAt
    ? 'cancelled'
    : new Date(m.endsAt).getTime() <= now
      ? 'ended'
      : new Date(m.startsAt).getTime() <= now
        ? 'live'
        : 'upcoming';

/**
 * Team meetings: the responsible doctor starts or plans a Google Meet with
 * chosen members of the staff. Each is an event of the connected Google
 * calendar (Google e-mails the invitations); Cabinova keeps who is invited,
 * rings their bell and shows the meeting while it runs.
 */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly google: GoogleConnectionService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Coming and running first (soonest first), then the last three months. */
  async list({ db }: ClinicContext, user: ClinicUser) {
    const viewer = user.role === 'owner' ? null : user.id;
    const [upcoming, past] = await Promise.all([
      db.query<MeetingRow>(
        `select ${COLUMNS} from meetings m left join users c on c.id = m.created_by
          where ${VISIBLE} and m.cancelled_at is null and m.ends_at > now()
          order by m.starts_at limit 50`,
        [viewer],
      ),
      db.query<MeetingRow>(
        `select ${COLUMNS} from meetings m left join users c on c.id = m.created_by
          where ${VISIBLE} and (m.cancelled_at is not null or m.ends_at <= now())
            and m.starts_at > now() - make_interval(days => ${HISTORY_DAYS})
          order by m.starts_at desc limit 30`,
        [viewer],
      ),
    ]);
    const shape = (m: MeetingRow) => ({ ...m, status: statusOf(m) });
    return { upcoming: upcoming.rows.map(shape), past: past.rows.map(shape) };
  }

  /** For the strip at the top of every page: running now, or about to. */
  async current({ db }: ClinicContext, user: ClinicUser) {
    const { rows } = await db.query<MeetingRow>(
      `select ${COLUMNS} from meetings m left join users c on c.id = m.created_by
        where (m.created_by = $1 or exists (
                select 1 from meeting_participants p where p.meeting_id = m.id and p.user_id = $1))
          and m.cancelled_at is null and m.ends_at > now()
          and m.starts_at < now() + make_interval(secs => $2)
        order by m.starts_at limit 3`,
      [user.id, SOON_MS / 1000],
    );
    return rows.map((m) => ({ ...m, status: statusOf(m) }));
  }

  /** The members who can be invited: the active staff, the owner apart. */
  async people({ db }: ClinicContext, user: ClinicUser) {
    assertOwner(user);
    const { rows } = await db.query<Omit<Person, 'email'>>(
      `select id, name, role from users
        where active and role <> 'owner' and password_hash is not null
        order by case role when 'doctor' then 0 else 1 end, name`,
    );
    return rows;
  }

  async create(ctx: ClinicContext, user: ClinicUser, dto: CreateMeetingDto) {
    assertOwner(user);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    if (startsAt.getTime() < Date.now() - PAST_GRACE_MS) {
      throw new BadRequestException({
        code: 'MEETING_IN_PAST',
        message: 'Choisissez une heure à venir.',
      });
    }
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);
    const people = await this.members(ctx.db, dto.participantIds);
    const title = dto.title ?? 'Réunion d’équipe';

    const event = await this.google.withGoogle(ctx, (token) =>
      createEvent(token, {
        title,
        description: `Réunion du cabinet ${ctx.tenant.name}, organisée depuis Cabinova.`,
        startsAt,
        endsAt,
        timeZone: TZ,
        attendees: people.map(({ email, name }) => ({ email, name })),
      }),
    );

    const { rows } = await ctx.db.query<{ id: string }>(
      `with m as (
         insert into meetings (title, starts_at, ends_at, meet_url, google_event_id, created_by)
         values ($1, $2, $3, $4, $5, $6) returning id
       ), p as (
         insert into meeting_participants (meeting_id, user_id)
         select m.id, unnest($7::uuid[]) from m
       )
       select id from m`,
      [
        title,
        startsAt,
        endsAt,
        event.meetUrl,
        event.eventId,
        user.id,
        people.map((p) => p.id),
      ],
    );
    const id = rows[0].id;
    await this.notifications.meeting(
      ctx.db,
      'invite',
      { id, title, startsAt },
      user.name,
      people.map((p) => p.id),
    );
    return this.get(ctx.db, id);
  }

  /** More people in a meeting that hasn't ended. */
  async addParticipants(
    ctx: ClinicContext,
    user: ClinicUser,
    id: string,
    dto: AddParticipantsDto,
  ) {
    assertOwner(user);
    const meeting = await this.open(ctx.db, id);
    const known = new Set(meeting.participants.map((p) => p.id));
    const added = await this.members(
      ctx.db,
      dto.userIds.filter((u) => !known.has(u)),
    );
    if (added.length === 0) return this.get(ctx.db, id);

    const everyone = await this.members(ctx.db, [
      ...known,
      ...added.map((p) => p.id),
    ]);
    await this.google.withGoogle(ctx, (token) =>
      setAttendees(
        token,
        meeting.googleEventId,
        everyone.map(({ email, name }) => ({ email, name })),
      ),
    );
    await ctx.db.query(
      `insert into meeting_participants (meeting_id, user_id)
       select $1, unnest($2::uuid[]) on conflict do nothing`,
      [id, added.map((p) => p.id)],
    );
    await this.notifications.meeting(
      ctx.db,
      'invite',
      meeting,
      user.name,
      added.map((p) => p.id),
    );
    return this.get(ctx.db, id);
  }

  /** Cancelled for everyone, in Google too (Google e-mails the guests). */
  async cancel(ctx: ClinicContext, user: ClinicUser, id: string) {
    assertOwner(user);
    const meeting = await this.open(ctx.db, id);
    await this.google.withGoogle(ctx, (token) =>
      deleteEvent(token, meeting.googleEventId),
    );
    await ctx.db.query(
      'update meetings set cancelled_at = now() where id = $1',
      [id],
    );
    await this.notifications.meeting(
      ctx.db,
      'cancelled',
      meeting,
      user.name,
      meeting.participants.map((p) => p.id),
    );
    return this.get(ctx.db, id);
  }

  private async get(db: Pool, id: string) {
    const { rows } = await db.query<MeetingRow>(
      `select ${COLUMNS} from meetings m left join users c on c.id = m.created_by
        where m.id = $1`,
      [id],
    );
    if (!rows[0]) throw this.notFound();
    return { ...rows[0], status: statusOf(rows[0]) };
  }

  /** A meeting still to come or running, with its Google event. */
  private async open(db: Pool, id: string) {
    const meeting = await this.get(db, id);
    if (meeting.status === 'cancelled' || meeting.status === 'ended') {
      throw new BadRequestException({
        code: 'MEETING_OVER',
        message: 'Cette réunion est terminée ou annulée.',
      });
    }
    const { rows } = await db.query<{ google_event_id: string }>(
      'select google_event_id from meetings where id = $1',
      [id],
    );
    return { ...meeting, googleEventId: rows[0].google_event_id };
  }

  /** Active staff with these ids; any other id is refused. */
  private async members(db: Pool, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const { rows } = await db.query<Person>(
      `select id, name, email, role from users
        where id = any($1::uuid[]) and active and role <> 'owner'
          and password_hash is not null
        order by name`,
      [unique],
    );
    if (rows.length !== unique.length) {
      throw new BadRequestException({
        code: 'INVALID_PARTICIPANTS',
        message: 'Certaines personnes ne font plus partie de l’équipe.',
      });
    }
    return rows;
  }

  private notFound() {
    return new NotFoundException({
      code: 'MEETING_NOT_FOUND',
      message: 'Réunion introuvable.',
    });
  }
}
