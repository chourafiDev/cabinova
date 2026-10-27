import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import { AuthService } from '../auth/auth.service.js';
import type { Transaction } from '../database/database.module.js';
import { DatabaseService } from '../database/database.module.js';
import {
  platformUsers,
  subscriptionPlans,
  subscriptions,
  supportMessages,
  supportTickets,
  tenants,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { FeaturesService } from '../features/features.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TeamAlertsService } from '../settings/team-alerts.service.js';
import type {
  AddMessageDto,
  CreateTicketDto,
  TicketsQuery,
  UpdateTicketDto,
} from './dto.js';
import { canSeeTicket, type TicketViewer } from './visibility.js';
import {
  ACTIVE_STATUSES,
  AUTO_CLOSE_DAYS,
  firstResponseDue,
  isOverdue,
  type TicketStatus,
} from './sla.js';

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting: 'En attente du cabinet',
  resolved: 'Résolu',
  closed: 'Clôturé',
};
const PRIORITY_LABELS = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};
const TYPE_LABELS = {
  assistance: 'Assistance',
  incident: 'Incident',
  configuration: 'Configuration',
  billing: 'Facturation',
};

const assignee = alias(platformUsers, 'assignee');
const priorityRank = sql<number>`case ${supportTickets.priority} when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end`;
const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');
const DAY_MS = 86_400_000;

type Ticket = typeof supportTickets.$inferSelect;

export type { TicketViewer } from './visibility.js';

/**
 * Support et assistance: tickets for cabinets (questions, incidents,
 * configuration and billing requests), assignment to agents, a first-answer
 * deadline per priority (shorter with "Support prioritaire"), and the
 * conversation — replies e-mailed to the cabinet, internal notes, and the
 * cabinet's answers logged by the agent.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
    private readonly features: FeaturesService,
    private readonly email: EmailService,
    private readonly alerts: TeamAlertsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The inbox: one view at a time, newest activity first (urgent on top while active). */
  async list(query: TicketsQuery, viewer: TicketViewer) {
    const db = this.database.db;
    const now = new Date();
    const term = query.search?.trim();
    const where = and(
      this.visibleTo(viewer),
      this.viewFilter(query.view, viewer.id, now),
      query.type ? eq(supportTickets.type, query.type) : undefined,
      query.priority ? eq(supportTickets.priority, query.priority) : undefined,
      query.tenantId ? eq(supportTickets.tenantId, query.tenantId) : undefined,
      term
        ? or(
            ilike(supportTickets.number, `%${escapeLike(term)}%`),
            ilike(supportTickets.subject, `%${escapeLike(term)}%`),
            ilike(supportTickets.requesterName, `%${escapeLike(term)}%`),
            ilike(supportTickets.requesterEmail, `%${escapeLike(term)}%`),
            ilike(tenants.name, `%${escapeLike(term)}%`),
          )
        : undefined,
    );
    const active = ['active', 'mine', 'unassigned', 'overdue'].includes(
      query.view,
    );
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          ticket: supportTickets,
          tenant: { id: tenants.id, name: tenants.name },
          assignee: { id: assignee.id, name: assignee.name },
          messages: sql<number>`(select count(*)::int from ${supportMessages} m where m.ticket_id = ${supportTickets.id} and m.kind <> 'event')`,
        })
        .from(supportTickets)
        .leftJoin(tenants, eq(tenants.id, supportTickets.tenantId))
        .leftJoin(assignee, eq(assignee.id, supportTickets.assigneeId))
        .where(where)
        .orderBy(
          ...(active ? [desc(priorityRank)] : []),
          desc(supportTickets.lastActivityAt),
        )
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db
        .select({ total: count() })
        .from(supportTickets)
        .leftJoin(tenants, eq(tenants.id, supportTickets.tenantId))
        .where(where),
    ]);
    return {
      data: rows.map((r) => ({
        ...this.publicTicket(r.ticket, now),
        tenant: r.tenant?.id ? r.tenant : null,
        assignee: r.assignee?.id ? r.assignee : null,
        messageCount: r.messages,
      })),
      total,
      pageCount: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  /** Counts per inbox view, plus the figures the dashboard shows. */
  async summary(viewer: TicketViewer) {
    const db = this.database.db;
    const now = new Date();
    const views = [
      'active',
      'mine',
      'unassigned',
      'overdue',
      'waiting',
    ] as const;
    const counts = await Promise.all(
      views.map((v) =>
        db
          .select({ n: count() })
          .from(supportTickets)
          .where(
            and(this.visibleTo(viewer), this.viewFilter(v, viewer.id, now)),
          )
          .then(([r]) => r.n),
      ),
    );
    const [[incidents], [resolved7d]] = await Promise.all([
      db
        .select({ n: count() })
        .from(supportTickets)
        .where(
          and(
            this.visibleTo(viewer),
            eq(supportTickets.type, 'incident'),
            inArray(supportTickets.status, [...ACTIVE_STATUSES]),
          ),
        ),
      db
        .select({ n: count() })
        .from(supportTickets)
        .where(
          and(
            this.visibleTo(viewer),
            gte(
              supportTickets.resolvedAt,
              new Date(now.getTime() - 7 * DAY_MS),
            ),
          ),
        ),
    ]);
    return {
      ...Object.fromEntries(views.map((v, i) => [v, counts[i]])),
      openIncidents: incidents.n,
      resolved7d: resolved7d.n,
    } as Record<(typeof views)[number], number> & {
      openIncidents: number;
      resolved7d: number;
    };
  }

  /** One ticket with its whole conversation and the cabinet's context. */
  async get(id: string, viewer: TicketViewer) {
    const db = this.database.db;
    const now = new Date();
    const [row] = await db
      .select({
        ticket: supportTickets,
        assignee: { id: assignee.id, name: assignee.name },
      })
      .from(supportTickets)
      .leftJoin(assignee, eq(assignee.id, supportTickets.assigneeId))
      .where(eq(supportTickets.id, id));
    // A colleague's ticket looks like a missing one: nothing is revealed.
    if (!row || !this.canSee(row.ticket, viewer)) {
      throw new NotFoundException('Ticket introuvable.');
    }
    const t = row.ticket;
    const [messages, cabinet, history] = await Promise.all([
      db
        .select({
          id: supportMessages.id,
          kind: supportMessages.kind,
          authorName: supportMessages.authorName,
          body: supportMessages.body,
          emailedTo: supportMessages.emailedTo,
          createdAt: supportMessages.createdAt,
        })
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, id))
        .orderBy(asc(supportMessages.createdAt)),
      t.tenantId ? this.cabinet(t.tenantId) : null,
      // The cabinet's other recent tickets, for context.
      t.tenantId
        ? db
            .select({
              id: supportTickets.id,
              number: supportTickets.number,
              subject: supportTickets.subject,
              status: supportTickets.status,
              createdAt: supportTickets.createdAt,
            })
            .from(supportTickets)
            .where(
              and(
                this.visibleTo(viewer),
                eq(supportTickets.tenantId, t.tenantId),
                ne(supportTickets.id, id),
              ),
            )
            .orderBy(desc(supportTickets.createdAt))
            .limit(5)
        : [],
    ]);
    return {
      ...this.publicTicket(t, now),
      assignee: row.assignee?.id ? row.assignee : null,
      cabinet,
      messages,
      otherTickets: history,
    };
  }

  /** Active platform users who can handle tickets (support:write). */
  async agents() {
    const users = await this.database.db
      .select({ id: platformUsers.id, name: platformUsers.name })
      .from(platformUsers)
      .where(
        and(
          eq(platformUsers.active, true),
          isNotNull(platformUsers.passwordHash),
        ),
      )
      .orderBy(asc(platformUsers.name));
    const withAccess = await Promise.all(
      users.map(async (u) => ({
        ...u,
        ok: (await this.auth.access(u.id)).permissions.includes(
          'support:write',
        ),
      })),
    );
    return withAccess.filter((u) => u.ok).map(({ id, name }) => ({ id, name }));
  }

  /** Every cabinet that can still ask for help (not closed), for the ticket form. */
  cabinets() {
    return this.database.db
      .select({
        id: tenants.id,
        name: tenants.name,
        responsibleName: tenants.responsibleName,
        email: tenants.email,
        city: tenants.city,
      })
      .from(tenants)
      .where(ne(tenants.status, 'closed'))
      .orderBy(asc(tenants.name));
  }

  async create(actor: AuditActor, dto: CreateTicketDto) {
    const db = this.database.db;
    const cabinet = dto.tenantId ? await this.cabinet(dto.tenantId) : null;
    if (dto.tenantId && !cabinet) {
      throw new NotFoundException('Cabinet introuvable.');
    }
    if (!dto.tenantId && dto.type !== 'incident') {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message:
          'Choisissez un cabinet (seul un incident peut concerner toute la plateforme).',
      });
    }
    if (dto.assigneeId) await this.assertAgent(dto.assigneeId);
    const author = await this.authorName(actor);
    const now = new Date();
    const requesterEmail =
      dto.requesterEmail ?? (cabinet ? cabinet.email : null);
    const requesterName =
      dto.requesterName ?? (cabinet ? cabinet.responsibleName : null);

    const ticket = await db.transaction(async (tx) => {
      const [{ n }] = await tx
        .execute<{ n: string }>(
          sql`select nextval('support_ticket_number_seq') as n`,
        )
        .then((r) => r.rows);
      const [created] = await tx
        .insert(supportTickets)
        .values({
          number: `T-${String(n).padStart(6, '0')}`,
          tenantId: dto.tenantId ?? null,
          type: dto.type,
          priority: dto.priority,
          status: dto.assigneeId ? 'in_progress' : 'open',
          channel: dto.channel,
          subject: dto.subject,
          requesterName,
          requesterEmail,
          assigneeId: dto.assigneeId ?? null,
          createdBy: actor.userId,
          prioritySupport: cabinet?.prioritySupport ?? false,
          firstResponseDueAt: firstResponseDue(
            now,
            dto.priority,
            cabinet?.prioritySupport ?? false,
          ),
          lastActivityAt: now,
        })
        .returning();
      // What the cabinet reported: theirs, unless it's our own finding.
      await tx.insert(supportMessages).values({
        ticketId: created.id,
        kind: dto.channel === 'internal' ? 'note' : 'clinic',
        authorId: dto.channel === 'internal' ? actor.userId : null,
        authorName: dto.channel === 'internal' ? author : requesterName,
        body: dto.description,
      });
      await writeAudit(tx, actor, {
        action: 'support.ticket.create',
        entity: 'support_ticket',
        entityId: created.id,
        tenantId: dto.tenantId,
        metadata: {
          number: created.number,
          type: dto.type,
          priority: dto.priority,
          channel: dto.channel,
        },
      });
      return created;
    });

    if (dto.type === 'incident' || dto.priority === 'urgent') {
      await this.notifications.notify({
        kind: 'support.ticket.urgent',
        severity: dto.type === 'incident' ? 'critical' : 'warning',
        title: `${dto.type === 'incident' ? 'Incident' : 'Ticket urgent'} ${ticket.number}`,
        body: `${cabinet?.name ?? 'Toute la plateforme'} — ${dto.subject}`,
        href: `/support/${ticket.id}`,
        tenantId: dto.tenantId,
        // Assigned: its agent and whoever sees every ticket; else the whole team.
        ...(dto.assigneeId
          ? { userIds: [dto.assigneeId], permission: 'support:all' as const }
          : { permission: 'support:read' as const }),
        exceptUserId: actor.userId,
      });
      await this.alerts.send('incidents', {
        subject: `${dto.type === 'incident' ? 'Incident' : 'Ticket urgent'} ${ticket.number} — ${dto.subject}`,
        lines: [
          `Cabinet : ${cabinet?.name ?? 'toute la plateforme'}`,
          dto.description.slice(0, 300),
        ],
        path: `/support/${ticket.id}`,
      });
    }
    if (dto.notify && requesterEmail && dto.channel !== 'internal') {
      await this.email.sendSupportMessage({
        email: requesterEmail,
        name: requesterName,
        tenantName: cabinet?.name ?? null,
        ticket,
        kind: 'acknowledgement',
        body: dto.description,
        agentName: null,
      });
    }
    if (dto.assigneeId) {
      await this.notifyAssigned(ticket, dto.assigneeId, actor, cabinet?.name);
    }
    return { id: ticket.id, number: ticket.number };
  }

  private async notifyAssigned(
    ticket: {
      id: string;
      number: string;
      subject: string;
      tenantId: string | null;
    },
    assigneeId: string,
    actor: AuditActor,
    cabinetName?: string | null,
  ) {
    if (assigneeId === actor.userId) return;
    await this.notifications.notify({
      kind: 'support.ticket.assigned',
      severity: 'info',
      title: `Ticket ${ticket.number} assigné à vous`,
      body: `${cabinetName ?? 'Toute la plateforme'} — ${ticket.subject}`,
      href: `/support/${ticket.id}`,
      tenantId: ticket.tenantId,
      userIds: [assigneeId],
    });
  }

  /** Status, priority, type, assignee, contact. Each change is written to the conversation. */
  async update(
    actor: AuditActor,
    id: string,
    dto: UpdateTicketDto,
    viewer: TicketViewer,
  ) {
    const db = this.database.db;
    const [current] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    if (!current || !this.canSee(current, viewer)) {
      throw new NotFoundException('Ticket introuvable.');
    }
    if (dto.assigneeId) await this.assertAgent(dto.assigneeId);
    const changes = diff(current, dto, [
      'status',
      'priority',
      'type',
      'assigneeId',
      'requesterName',
      'requesterEmail',
    ]);
    if (!Object.keys(changes).length) return this.get(id, viewer);
    const author = await this.authorName(actor);

    await db.transaction(async (tx) => {
      const now = new Date();
      const set: Partial<Ticket> = {
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.requesterName !== undefined && {
          requesterName: dto.requesterName,
        }),
        ...(dto.requesterEmail !== undefined && {
          requesterEmail: dto.requesterEmail,
        }),
        ...(changes.status && this.statusFields(dto.status!, current, now)),
        lastActivityAt: now,
      };
      // A new priority moves the deadline while nobody has answered yet.
      if (changes.priority && !current.firstResponseAt) {
        set.firstResponseDueAt = firstResponseDue(
          current.createdAt,
          dto.priority!,
          current.prioritySupport,
        );
      }
      // Taking a new ticket puts it in progress.
      if (
        changes.assigneeId &&
        dto.assigneeId &&
        !changes.status &&
        current.status === 'open'
      ) {
        Object.assign(set, this.statusFields('in_progress', current, now));
        changes.status = { from: 'open', to: 'in_progress' };
      }
      await tx.update(supportTickets).set(set).where(eq(supportTickets.id, id));
      const events = await this.describe(tx, changes);
      if (events.length) {
        await tx.insert(supportMessages).values({
          ticketId: id,
          kind: 'event',
          authorId: actor.userId,
          authorName: author,
          body: events.join('\n'),
        });
      }
      await writeAudit(tx, actor, {
        action: changes.status
          ? `support.ticket.${dto.status === 'resolved' || dto.status === 'closed' ? dto.status : 'update'}`
          : 'support.ticket.update',
        entity: 'support_ticket',
        entityId: id,
        tenantId: current.tenantId ?? undefined,
        metadata: { number: current.number, changes },
      });
    });
    if (changes.assigneeId && dto.assigneeId) {
      await this.notifyAssigned(current, dto.assigneeId, actor);
    }
    // Handed over to a colleague: this agent no longer sees it.
    const after = {
      ...current,
      assigneeId:
        dto.assigneeId !== undefined ? dto.assigneeId : current.assigneeId,
    };
    if (!this.canSee(after, viewer)) return { id, handedOver: true as const };
    return this.get(id, viewer);
  }

  /**
   * A reply (e-mailed to the cabinet, counts as the first answer), an
   * internal note, or the cabinet's answer received by phone or e-mail.
   */
  async addMessage(
    actor: AuditActor,
    id: string,
    dto: AddMessageDto,
    viewer: TicketViewer,
  ) {
    const db = this.database.db;
    const [current] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    if (!current || !this.canSee(current, viewer)) {
      throw new NotFoundException('Ticket introuvable.');
    }
    const cabinet = current.tenantId
      ? await this.cabinet(current.tenantId)
      : null;
    const recipient = current.requesterEmail ?? cabinet?.email ?? null;
    if (dto.kind === 'reply' && !recipient) {
      throw new BadRequestException({
        code: 'NO_RECIPIENT',
        message:
          'Aucune adresse e-mail pour ce ticket : ajoutez le contact du cabinet, ou écrivez une note interne.',
      });
    }
    const author = await this.authorName(actor);
    const now = new Date();
    const nextStatus: TicketStatus =
      dto.status ??
      (dto.kind === 'reply'
        ? ['open', 'in_progress'].includes(current.status)
          ? 'waiting'
          : current.status
        : dto.kind === 'clinic'
          ? current.status === 'in_progress'
            ? 'in_progress'
            : 'open'
          : current.status);

    await db.transaction(async (tx) => {
      await tx.insert(supportMessages).values({
        ticketId: id,
        kind: dto.kind,
        authorId: actor.userId,
        authorName: dto.kind === 'clinic' ? current.requesterName : author,
        body: dto.body,
        emailedTo: dto.kind === 'reply' ? recipient : null,
        createdAt: now,
      });
      const set: Partial<Ticket> = { lastActivityAt: now };
      if (dto.kind === 'reply' && !current.firstResponseAt) {
        set.firstResponseAt = now;
      }
      // Whoever answers an unassigned ticket takes it.
      if (dto.kind === 'reply' && !current.assigneeId && actor.userId) {
        set.assigneeId = actor.userId;
      }
      if (nextStatus !== current.status) {
        Object.assign(set, this.statusFields(nextStatus, current, now));
        await tx.insert(supportMessages).values({
          ticketId: id,
          kind: 'event',
          authorId: actor.userId,
          authorName: author,
          body: `Statut : ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[nextStatus]}`,
          createdAt: new Date(now.getTime() + 1),
        });
      }
      await tx.update(supportTickets).set(set).where(eq(supportTickets.id, id));
      if (dto.kind === 'reply') {
        await writeAudit(tx, actor, {
          action: 'support.ticket.reply',
          entity: 'support_ticket',
          entityId: id,
          tenantId: current.tenantId ?? undefined,
          metadata: { number: current.number, emailedTo: recipient },
        });
      }
    });

    if (dto.kind === 'reply') {
      await this.email.sendSupportMessage({
        email: recipient!,
        name: current.requesterName,
        tenantName: cabinet?.name ?? null,
        ticket: current,
        kind: 'reply',
        body: dto.body,
        agentName: author,
      });
    }
    return this.get(id, viewer);
  }

  /**
   * Every few minutes: notify tickets that just missed their first-answer
   * deadline (once each), and close resolved tickets quiet for
   * AUTO_CLOSE_DAYS.
   */
  async sweep() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - AUTO_CLOSE_DAYS * DAY_MS);
    const late = await this.database.db
      .update(supportTickets)
      .set({ overdueNotifiedAt: now })
      .where(
        and(
          inArray(supportTickets.status, [...ACTIVE_STATUSES]),
          isNull(supportTickets.firstResponseAt),
          isNull(supportTickets.overdueNotifiedAt),
          lt(supportTickets.firstResponseDueAt, now),
        ),
      )
      .returning();
    for (const t of late) {
      await this.notifications.notify({
        kind: 'support.ticket.overdue',
        severity: 'warning',
        title: `Ticket ${t.number} hors délai`,
        body: `Pas de première réponse — ${t.subject}`,
        href: `/support/${t.id}`,
        tenantId: t.tenantId,
        // The assignee if there is one, else the whole support team.
        ...(t.assigneeId
          ? { userIds: [t.assigneeId] }
          : { permission: 'support:read' as const }),
      });
    }
    return this.database.db.transaction(async (tx) => {
      const stale = await tx
        .update(supportTickets)
        .set({ status: 'closed', closedAt: now })
        .where(
          and(
            eq(supportTickets.status, 'resolved'),
            lt(supportTickets.lastActivityAt, cutoff),
          ),
        )
        .returning({ id: supportTickets.id });
      if (stale.length) {
        await tx.insert(supportMessages).values(
          stale.map((t) => ({
            ticketId: t.id,
            kind: 'event' as const,
            authorName: 'Cabinova',
            body: `Clôturé automatiquement après ${AUTO_CLOSE_DAYS} jours sans nouvelle activité.`,
          })),
        );
      }
      return { closed: stale.length, overdue: late.length };
    });
  }

  /** Rows this viewer may see (undefined = all). */
  private visibleTo(viewer: TicketViewer): SQL | undefined {
    return viewer.all
      ? undefined
      : or(
          isNull(supportTickets.assigneeId),
          eq(supportTickets.assigneeId, viewer.id),
        );
  }

  private canSee(t: Pick<Ticket, 'assigneeId'>, viewer: TicketViewer) {
    return canSeeTicket(t, viewer);
  }

  private viewFilter(
    view: TicketsQuery['view'],
    userId: string,
    now: Date,
  ): SQL | undefined {
    const active = inArray(supportTickets.status, [...ACTIVE_STATUSES]);
    switch (view) {
      case 'active':
        return active;
      case 'mine':
        return and(active, eq(supportTickets.assigneeId, userId));
      case 'unassigned':
        return and(active, isNull(supportTickets.assigneeId));
      case 'overdue':
        return and(
          active,
          isNull(supportTickets.firstResponseAt),
          lt(supportTickets.firstResponseDueAt, now),
        );
      case 'waiting':
        return eq(supportTickets.status, 'waiting');
      case 'done':
        return inArray(supportTickets.status, ['resolved', 'closed']);
      default:
        return undefined;
    }
  }

  private statusFields(status: TicketStatus, current: Ticket, now: Date) {
    return {
      status,
      resolvedAt:
        status === 'resolved' || status === 'closed'
          ? (current.resolvedAt ?? now)
          : null,
      closedAt: status === 'closed' ? now : null,
    };
  }

  private publicTicket(t: Ticket, now: Date) {
    return {
      id: t.id,
      number: t.number,
      subject: t.subject,
      type: t.type,
      priority: t.priority,
      status: t.status,
      channel: t.channel,
      requesterName: t.requesterName,
      requesterEmail: t.requesterEmail,
      prioritySupport: t.prioritySupport,
      firstResponseDueAt: t.firstResponseDueAt,
      firstResponseAt: t.firstResponseAt,
      resolvedAt: t.resolvedAt,
      closedAt: t.closedAt,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
      overdue: isOverdue(t, now),
    };
  }

  /** The cabinet as the support agent needs it: contact, plan, priority support. */
  private async cabinet(tenantId: string) {
    const [row] = await this.database.db
      .select({
        id: tenants.id,
        name: tenants.name,
        status: tenants.status,
        responsibleName: tenants.responsibleName,
        email: tenants.email,
        phone: tenants.phone,
        city: tenants.city,
        plan: subscriptionPlans.name,
      })
      .from(tenants)
      .leftJoin(
        subscriptions,
        and(
          eq(subscriptions.tenantId, tenants.id),
          ne(subscriptions.status, 'cancelled'),
        ),
      )
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(eq(tenants.id, tenantId));
    if (!row) return null;
    const { features } = await this.features.forTenant(tenantId);
    const prioritySupport =
      features.find((f) => f.key === 'priority_support')?.effective.enabled ??
      false;
    return { ...row, prioritySupport };
  }

  private async assertAgent(userId: string) {
    const [user] = await this.database.db
      .select({ active: platformUsers.active })
      .from(platformUsers)
      .where(eq(platformUsers.id, userId));
    const access = user?.active ? await this.auth.access(userId) : null;
    if (!access?.permissions.includes('support:write')) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Cette personne ne peut pas traiter les tickets.',
      });
    }
  }

  private async authorName(actor: AuditActor) {
    if (!actor.userId) return 'Cabinova';
    const [user] = await this.database.db
      .select({ name: platformUsers.name })
      .from(platformUsers)
      .where(eq(platformUsers.id, actor.userId));
    return user?.name ?? null;
  }

  /** Human sentences for the conversation timeline. */
  private async describe(
    tx: Transaction,
    changes: Record<string, { from: unknown; to: unknown }>,
  ) {
    const lines: string[] = [];
    if (changes.status) {
      lines.push(
        `Statut : ${STATUS_LABELS[changes.status.from as TicketStatus]} → ${STATUS_LABELS[changes.status.to as TicketStatus]}`,
      );
    }
    if (changes.priority) {
      lines.push(
        `Priorité : ${PRIORITY_LABELS[changes.priority.from as keyof typeof PRIORITY_LABELS]} → ${PRIORITY_LABELS[changes.priority.to as keyof typeof PRIORITY_LABELS]}`,
      );
    }
    if (changes.type) {
      lines.push(
        `Type : ${TYPE_LABELS[changes.type.from as keyof typeof TYPE_LABELS]} → ${TYPE_LABELS[changes.type.to as keyof typeof TYPE_LABELS]}`,
      );
    }
    if (changes.assigneeId) {
      const to = changes.assigneeId.to as string | null;
      const [user] = to
        ? await tx
            .select({ name: platformUsers.name })
            .from(platformUsers)
            .where(eq(platformUsers.id, to))
        : [];
      lines.push(to ? `Assigné à ${user?.name ?? '—'}` : 'Désassigné');
    }
    if (changes.requesterName || changes.requesterEmail) {
      lines.push('Contact du cabinet modifié');
    }
    return lines;
  }
}
