import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { filter, map, Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service.js';
import type { PlatformPermission } from '../auth/permissions.js';
import { DatabaseService } from '../database/database.module.js';
import {
  platformNotifications,
  platformUsers,
} from '../database/schema/index.js';

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';
type Row = typeof platformNotifications.$inferSelect;

export type NotifyInput = {
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  href?: string;
  tenantId?: string | null;
  /** Everyone with this permission… */
  permission?: PlatformPermission;
  /** …and/or these users. */
  userIds?: string[];
  /** Never notify the person who caused it. */
  exceptUserId?: string | null;
};

/**
 * The bell: one saved notification per recipient, pushed live to their open
 * tabs over SSE. Recipients are chosen by permission (or by id), so nobody
 * sees an event about a page they can't open.
 *
 * Live delivery is in-process: with several API instances, each pushes only
 * to its own connections (the others still see it on refresh). A shared
 * channel (Redis pub/sub) is the step up when scaling out.
 */
@Injectable()
export class NotificationsService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly live = new Subject<Row>();
  /** Emits once when the API stops: open SSE streams end with it. */
  readonly closing = new Subject<void>();

  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  /** Never throws: a notification must not break what triggered it. */
  async notify(input: NotifyInput) {
    try {
      const recipients = await this.recipients(input);
      if (!recipients.length) return;
      const rows = await this.database.db
        .insert(platformNotifications)
        .values(
          recipients.map((userId) => ({
            userId,
            kind: input.kind,
            severity: input.severity,
            title: input.title,
            body: input.body ?? null,
            href: input.href ?? null,
            tenantId: input.tenantId ?? null,
          })),
        )
        .returning();
      for (const row of rows) this.live.next(row);
    } catch (err) {
      this.logger.error(`Notification "${input.kind}" failed`, err);
    }
  }

  /**
   * Before the HTTP server closes: end every live stream. An open SSE
   * response never ends by itself, so the server would wait for it forever
   * (a dev restart hangs while a Super Admin tab is open). Browsers
   * reconnect to the next server on their own.
   */
  async beforeApplicationShutdown() {
    this.closing.next();
    this.closing.complete();
    // Let the ended responses settle into idle connections, which the
    // server's close() then drops at once (instead of after keep-alive).
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /** Live feed for one user (SSE). */
  stream(userId: string) {
    return this.live.pipe(
      filter((n) => n.userId === userId),
      map((n) => ({ type: 'notification', data: this.public(n) })),
    );
  }

  async list(userId: string, limit = 30) {
    const db = this.database.db;
    const [rows, [{ unread }]] = await Promise.all([
      db
        .select()
        .from(platformNotifications)
        .where(eq(platformNotifications.userId, userId))
        .orderBy(desc(platformNotifications.createdAt))
        .limit(limit),
      db
        .select({ unread: count() })
        .from(platformNotifications)
        .where(
          and(
            eq(platformNotifications.userId, userId),
            isNull(platformNotifications.readAt),
          ),
        ),
    ]);
    return { data: rows.map((r) => this.public(r)), unread };
  }

  async markRead(userId: string, ids: string[] | 'all') {
    await this.database.db
      .update(platformNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(platformNotifications.userId, userId),
          isNull(platformNotifications.readAt),
          ids === 'all' ? undefined : inArray(platformNotifications.id, ids),
        ),
      );
    return this.list(userId);
  }

  private public(n: Row) {
    return {
      id: n.id,
      kind: n.kind,
      severity: n.severity,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt,
      createdAt: n.createdAt,
    };
  }

  /** Active users with the permission, plus the named ones, minus the actor. */
  private async recipients(input: NotifyInput) {
    const ids = new Set(input.userIds ?? []);
    if (input.permission) {
      const users = await this.database.db
        .select({ id: platformUsers.id })
        .from(platformUsers)
        .where(
          and(
            eq(platformUsers.active, true),
            isNotNull(platformUsers.passwordHash),
          ),
        );
      const allowed = await Promise.all(
        users.map(async (u) =>
          (await this.auth.access(u.id)).permissions.includes(input.permission!)
            ? u.id
            : null,
        ),
      );
      for (const id of allowed) if (id) ids.add(id);
    }
    if (input.exceptUserId) ids.delete(input.exceptUserId);
    return [...ids];
  }
}
