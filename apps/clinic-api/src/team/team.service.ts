import type { Pool, PoolClient } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner, ROLE_LABELS } from '../auth/roles.js';
import { hashToken, newToken } from '../auth/tokens.js';
import { TwoFactorService } from '../auth/two-factor.service.js';
import type { Env } from '../config/env.js';
import { CatalogService } from '../database/catalog.module.js';
import { MailService } from '../mail/mail.service.js';
import type {
  ClinicContext,
  ClinicTenant,
} from '../tenancy/tenancy.service.js';
import type { InviteMemberDto, UpdateMemberDto } from './dto.js';

/** Same validity as the owner's invitation (admin-api provisioning). */
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type MemberStatus = 'active' | 'invited' | 'expired' | 'disabled';

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: MemberStatus;
  /** Invitation not accepted yet: when its link stops working. */
  inviteExpiresAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  spaceIds: string[];
  /** Appointments to come with them as the doctor. */
  upcomingAppointments: number;
  twoFactor: boolean;
};

type MemberRow = Omit<Member, 'roleLabel' | 'status'> & {
  active: boolean;
  hasPassword: boolean;
};

/** Doctors (the owner included) and secretaries count against the offer separately. */
const groupOf = (role: string) =>
  role === 'secretary' ? 'secretaries' : 'doctors';

const MEMBERS = `
  select u.id, u.name, u.email, u.role, u.active,
         u.password_hash is not null as "hasPassword",
         u.totp_enabled_at is not null as "twoFactor",
         u.invite_expires_at as "inviteExpiresAt",
         u.last_login_at as "lastLoginAt", u.created_at as "createdAt",
         coalesce(array_agg(m.space_id::text order by m.created_at)
                  filter (where m.space_id is not null), '{}') as "spaceIds",
         (select count(*)::int from appointments a
           where a.practitioner_id = u.id and a.starts_at >= now()
             and a.status not in ('cancelled', 'no_show')) as "upcomingAppointments"
    from users u left join space_members m on m.user_id = u.id`;

/**
 * Équipe: the owner invites doctors and secretaries, chooses their spaces,
 * deactivates them or sends them a new password link. Accounts live in the
 * cabinet's database; the offer's limits come from the catalog.
 */
@Injectable()
export class TeamService {
  private readonly appUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly catalog: CatalogService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
  ) {
    this.appUrl =
      config.get('CLINIC_APP_URL', { infer: true }) ??
      (config.get('NODE_ENV') === 'production'
        ? `https://{subdomain}.${config.get('TENANT_BASE_DOMAIN')}`
        : 'http://{subdomain}.localhost:3002');
  }

  /** Everyone, the owner first; with the offer's limits and the open spaces. */
  async list({ tenant, db }: ClinicContext, user: ClinicUser) {
    assertOwner(user);
    const [{ rows }, limits, spaces, settings] = await Promise.all([
      db.query<MemberRow>(
        `${MEMBERS} group by u.id
          order by u.role = 'owner' desc, u.active desc, u.name`,
      ),
      this.limits(tenant.id, db),
      db.query<{ id: string; name: string; city: string | null }>(
        'select id, name, city from spaces where active order by created_at, name',
      ),
      db.query<{ required: boolean }>(
        'select require_two_factor as required from clinic_settings where id = 1',
      ),
    ]);
    return {
      members: rows.map(toMember),
      limits,
      spaces: spaces.rows,
      requireTwoFactor: settings.rows[0].required,
    };
  }

  async invite(
    { tenant, db }: ClinicContext,
    user: ClinicUser,
    dto: InviteMemberDto,
  ) {
    assertOwner(user);
    const token = newToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    const id = await this.tx(db, async (client) => {
      const { rows: taken } = await client.query<{ active: boolean }>(
        'select active from users where lower(email) = $1',
        [dto.email],
      );
      if (taken[0]) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: taken[0].active
            ? 'Un membre de l’équipe utilise déjà cet e-mail.'
            : 'Cet e-mail est celui d’un membre désactivé : réactivez-le plutôt.',
        });
      }
      await this.assertSpaces(client, dto.spaceIds);
      await this.assertRoom(client, tenant.id, dto.role);
      const { rows } = await client.query<{ id: string }>(
        `insert into users (name, email, role, invite_token_hash, invite_expires_at)
         values ($1, $2, $3, $4, $5) returning id`,
        [dto.name, dto.email, dto.role, hashToken(token), expiresAt],
      );
      await this.setSpaces(client, rows[0].id, dto.spaceIds);
      return rows[0].id;
    });
    const member = await this.find(db, id);
    const url = this.linkUrl(tenant, token);
    const delivery = await this.mail.sendInvitation({
      email: member.email,
      name: member.name,
      cabinetName: tenant.name,
      invitedBy: user.name,
      roleLabel: member.roleLabel,
      url,
    });
    return { member, link: { url, expiresAt, delivery, kind: 'invitation' } };
  }

  /** Name, role and spaces. The owner edits themself in Paramètres. */
  async update(
    { tenant, db }: ClinicContext,
    user: ClinicUser,
    id: string,
    dto: UpdateMemberDto,
  ) {
    assertOwner(user);
    await this.tx(db, async (client) => {
      const target = await this.staff(client, id);
      if (target.role !== dto.role) {
        if (target.role === 'doctor' && target.upcomingAppointments > 0) {
          throw new ConflictException({
            code: 'HAS_APPOINTMENTS',
            message: `${target.upcomingAppointments} rendez-vous à venir ${target.upcomingAppointments > 1 ? 'sont' : 'est'} au nom de ce médecin : déplacez-les ou annulez-les avant de changer son rôle.`,
          });
        }
        if (target.active) await this.assertRoom(client, tenant.id, dto.role);
      }
      await this.assertSpaces(client, dto.spaceIds);
      await client.query(
        'update users set name = $2, role = $3, updated_at = now() where id = $1',
        [id, dto.name, dto.role],
      );
      await this.setSpaces(client, id, dto.spaceIds);
    });
    return this.find(db, id);
  }

  /**
   * A new link: the invitation again for someone who hasn't joined, else a
   * password link. Earlier links stop working; the password in use stays
   * valid until a new one is chosen.
   */
  async issueLink({ tenant, db }: ClinicContext, user: ClinicUser, id: string) {
    assertOwner(user);
    const target = await this.staff(db, id);
    if (!target.active) {
      throw new ConflictException({
        code: 'MEMBER_DISABLED',
        message: 'Ce membre est désactivé : réactivez-le d’abord.',
      });
    }
    const token = newToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    await db.query(
      `update users set invite_token_hash = $2, invite_expires_at = $3,
              updated_at = now() where id = $1`,
      [id, hashToken(token), expiresAt],
    );
    const url = this.linkUrl(tenant, token);
    const kind = target.hasPassword ? 'password' : 'invitation';
    const delivery =
      kind === 'invitation'
        ? await this.mail.sendInvitation({
            email: target.email,
            name: target.name,
            cabinetName: tenant.name,
            invitedBy: user.name,
            roleLabel: ROLE_LABELS[target.role] ?? target.role,
            url,
          })
        : await this.mail.sendPasswordLink({
            email: target.email,
            name: target.name,
            cabinetName: tenant.name,
            url,
          });
    return {
      member: await this.find(db, id),
      link: { url, expiresAt, delivery, kind },
    };
  }

  /**
   * Deactivating signs them out everywhere and voids their link; their
   * appointments and history stay. Reactivating counts against the offer.
   */
  async setActive(
    { tenant, db }: ClinicContext,
    user: ClinicUser,
    id: string,
    active: boolean,
  ) {
    assertOwner(user);
    await this.tx(db, async (client) => {
      const target = await this.staff(client, id);
      if (active === target.active) return;
      if (active) {
        await this.assertRoom(client, tenant.id, target.role);
        await client.query(
          'update users set active = true, updated_at = now() where id = $1',
          [id],
        );
      } else {
        await client.query(
          `update users set active = false, invite_token_hash = null,
                  invite_expires_at = null, updated_at = now() where id = $1`,
          [id],
        );
        await client.query('delete from sessions where user_id = $1', [id]);
      }
    });
    return this.find(db, id);
  }

  /** Lost phone: turns off a member's 2FA; they're told by e-mail. */
  async resetTwoFactor(clinic: ClinicContext, user: ClinicUser, id: string) {
    assertOwner(user);
    const member = await this.find(clinic.db, id);
    if (member.role === 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESET',
        message:
          'Pour votre propre compte, utilisez vos codes de secours ou contactez le support.',
      });
    }
    await this.twoFactor.reset(clinic, user, id);
    await this.mail.sendTwoFactorReset({
      email: member.email,
      name: member.name,
      cabinetName: clinic.tenant.name,
    });
    return { ok: true };
  }

  /** Only an invitation nobody accepted; members who joined are deactivated. */
  async remove(db: Pool, user: ClinicUser, id: string) {
    assertOwner(user);
    const target = await this.staff(db, id);
    if (target.hasPassword) {
      throw new ConflictException({
        code: 'ALREADY_JOINED',
        message: 'Ce membre a déjà rejoint le cabinet : désactivez-le plutôt.',
      });
    }
    try {
      await db.query('delete from users where id = $1', [id]);
    } catch (err) {
      // Booked as the doctor of appointments (practitioner_id restricts).
      if ((err as { code?: string }).code === '23503') {
        throw new ConflictException({
          code: 'HAS_HISTORY',
          message: 'Des rendez-vous sont à son nom : désactivez-le plutôt.',
        });
      }
      throw err;
    }
  }

  /** Doctors (owner included) and secretaries: active accounts against the offer. */
  private async limits(tenantId: string, db: Pool | PoolClient) {
    const [{ rows: offer }, { rows: used }] = await Promise.all([
      this.catalog.pool.query<{
        max_doctors: number | null;
        max_secretaries: number | null;
      }>('select max_doctors, max_secretaries from tenants where id = $1', [
        tenantId,
      ]),
      db.query<{ doctors: number; secretaries: number }>(
        `select count(*) filter (where role in ('owner', 'doctor'))::int as doctors,
                count(*) filter (where role = 'secretary')::int as secretaries
           from users where active`,
      ),
    ]);
    return {
      doctors: { used: used[0].doctors, max: offer[0]?.max_doctors ?? null },
      secretaries: {
        used: used[0].secretaries,
        max: offer[0]?.max_secretaries ?? null,
      },
    };
  }

  /** One more active member of this role fits in the offer (call inside tx). */
  private async assertRoom(client: PoolClient, tenantId: string, role: string) {
    const group = groupOf(role);
    const { used, max } = (await this.limits(tenantId, client))[group];
    if (max === null || used < max) return;
    const what =
      group === 'doctors'
        ? `${max} médecin${max > 1 ? 's' : ''}, vous compris`
        : `${max} secrétaire${max > 1 ? 's' : ''}`;
    throw new ConflictException({
      code: 'LIMIT_REACHED',
      message:
        max === 0
          ? 'Votre offre ne comprend pas de secrétaire. Changez d’offre pour en ajouter.'
          : `Votre offre comprend ${what}. Désactivez un membre ou changez d’offre.`,
    });
  }

  /** Open spaces of this cabinet, each once. */
  private async assertSpaces(client: PoolClient, spaceIds: string[]) {
    const ids = [...new Set(spaceIds)];
    const { rows } = await client.query<{ n: number }>(
      'select count(*)::int as n from spaces where active and id = any($1::uuid[])',
      [ids],
    );
    if (rows[0].n !== ids.length) {
      throw new BadRequestException({
        code: 'INVALID_SPACES',
        message: 'Choisissez des espaces ouverts du cabinet.',
      });
    }
  }

  private async setSpaces(client: PoolClient, userId: string, ids: string[]) {
    await client.query(
      'delete from space_members where user_id = $1 and space_id <> all($2::uuid[])',
      [userId, ids],
    );
    await client.query(
      `insert into space_members (space_id, user_id)
       select unnest($2::uuid[]), $1 on conflict do nothing`,
      [userId, [...new Set(ids)]],
    );
  }

  /** A doctor or secretary (never the owner), with what the rules need. */
  private async staff(db: Pool | PoolClient, id: string) {
    const { rows } = await db.query<MemberRow>(
      `${MEMBERS} where u.id = $1 group by u.id`,
      [id],
    );
    const row = rows[0];
    if (!row) throw this.notFound();
    if (row.role === 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_LOCKED',
        message:
          'Le médecin responsable modifie son compte dans Paramètres › Mon profil.',
      });
    }
    return row;
  }

  private async find(db: Pool, id: string) {
    const { rows } = await db.query<MemberRow>(
      `${MEMBERS} where u.id = $1 group by u.id`,
      [id],
    );
    if (!rows[0]) throw this.notFound();
    return toMember(rows[0]);
  }

  private linkUrl(tenant: ClinicTenant, token: string) {
    return `${this.appUrl.replace('{subdomain}', tenant.subdomain)}/invite/${token}`;
  }

  /**
   * One transaction; team changes are serialized per cabinet so two
   * invitations can't both take the offer's last seat.
   */
  private async tx<T>(db: Pool, fn: (client: PoolClient) => Promise<T>) {
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('team'))");
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'MEMBER_NOT_FOUND',
      message: 'Membre introuvable.',
    });
  }
}

function toMember({ active, hasPassword, ...row }: MemberRow): Member {
  const status: MemberStatus = !active
    ? 'disabled'
    : hasPassword
      ? 'active'
      : row.inviteExpiresAt && row.inviteExpiresAt > new Date()
        ? 'invited'
        : 'expired';
  return {
    ...row,
    roleLabel: ROLE_LABELS[row.role] ?? row.role,
    status,
    // A password link sent to a member isn't an invitation.
    inviteExpiresAt: hasPassword ? null : row.inviteExpiresAt,
  };
}
