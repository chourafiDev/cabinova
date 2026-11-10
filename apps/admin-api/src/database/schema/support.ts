import {
  boolean,
  index,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';
import { platformUsers } from './platform-users.js';
import { tenants } from './tenants.js';

// Support et assistance: tickets raised by (or for) cabinets, and the
// conversation around each one. Tickets are entered by agents for now
// (phone, e-mail); the clinic app will create them directly later
// (channel 'clinic_app'). Never any patient data here.

/** Question, incident (something broken), configuration request, billing question. */
export const supportTicketType = pgEnum('support_ticket_type', [
  'assistance',
  'incident',
  'configuration',
  'billing',
]);

export const supportTicketPriority = pgEnum('support_ticket_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

/**
 * open        — new or back from the cabinet, needs us
 * in_progress — an agent is on it
 * waiting     — waiting for the cabinet's answer
 * resolved    — answered/fixed; closes itself after 7 quiet days
 * closed      — done (a new cabinet message reopens it)
 */
export const supportTicketStatus = pgEnum('support_ticket_status', [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
]);

export const supportChannel = pgEnum('support_channel', [
  'phone',
  'email',
  'clinic_app',
  'internal',
]);

/**
 * reply  — from us to the cabinet (e-mailed)
 * clinic — from the cabinet (logged by an agent, or from the clinic app)
 * note   — internal, never shown to the cabinet
 * event  — status/assignment/priority change, written by the platform
 */
export const supportMessageKind = pgEnum('support_message_kind', [
  'reply',
  'clinic',
  'note',
  'event',
]);

/** T-000001, T-000002… */
export const supportTicketNumberSeq = pgSequence('support_ticket_number_seq');

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: id(),
    number: text('number').notNull().unique(),
    /** NULL for a platform-wide incident. */
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'restrict',
    }),
    type: supportTicketType('type').notNull(),
    priority: supportTicketPriority('priority').notNull().default('normal'),
    status: supportTicketStatus('status').notNull().default('open'),
    channel: supportChannel('channel').notNull(),
    subject: text('subject').notNull(),
    /** Who asked, at the cabinet. Replies are e-mailed here. */
    requesterName: text('requester_name'),
    requesterEmail: text('requester_email'),
    assigneeId: uuid('assignee_id').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    /** The cabinet had "Support prioritaire" when the ticket was opened. */
    prioritySupport: boolean('priority_support').notNull().default(false),
    firstResponseDueAt: timestamp('first_response_due_at', {
      withTimezone: true,
    }).notNull(),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    /** In-app "deadline missed" notification already sent. */
    overdueNotifiedAt: timestamp('overdue_notified_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    index('support_tickets_status_idx').on(t.status),
    index('support_tickets_tenant_idx').on(t.tenantId),
    index('support_tickets_assignee_idx').on(t.assigneeId),
  ],
);

export const supportMessages = pgTable(
  'support_messages',
  {
    id: id(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    kind: supportMessageKind('kind').notNull(),
    /** The agent who wrote or logged it; NULL for the platform or the clinic app. */
    authorId: uuid('author_id').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    /** Display name kept as written (the cabinet contact, or the agent). */
    authorName: text('author_name'),
    body: text('body').notNull(),
    /** Address the reply was e-mailed to, when it was. */
    emailedTo: text('emailed_to'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('support_messages_ticket_idx').on(t.ticketId, t.createdAt)],
);
