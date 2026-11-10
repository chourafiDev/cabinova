import { Injectable } from '@nestjs/common';
import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { DatabaseService } from '../database/database.module.js';
import {
  platformAuditLogs,
  platformUsers,
  tenants,
} from '../database/schema/index.js';
import {
  AUDIT_CATEGORIES,
  type AuditCategory,
  categoryOf,
  SENSITIVE_ACTIONS,
} from './catalog.js';
import type { AuditQuery } from './dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPORT_LIMIT = 10_000;
const actor = aliasedTable(platformUsers, 'actor');

/**
 * Sécurité et conformité — the platform-wide audit journal (every admin
 * action, sign-in, failed sign-in and 2FA event), filtered and exportable,
 * plus a short security summary.
 */
@Injectable()
export class SecurityService {
  constructor(private readonly database: DatabaseService) {}

  async journal(q: AuditQuery) {
    const db = this.database.db;
    const where = this.where(q);
    const [rows, [{ total }]] = await Promise.all([
      this.rows(where, q.perPage, (q.page - 1) * q.perPage),
      db
        .select({ total: count() })
        .from(platformAuditLogs)
        .leftJoin(actor, eq(actor.id, platformAuditLogs.userId))
        .leftJoin(tenants, eq(tenants.id, platformAuditLogs.tenantId))
        .where(where),
    ]);
    return {
      data: rows,
      total,
      pageCount: Math.max(1, Math.ceil(total / q.perPage)),
    };
  }

  /** Same filters, up to 10 000 rows, for the CSV export. */
  exportRows(q: AuditQuery) {
    return this.rows(this.where(q), EXPORT_LIMIT, 0);
  }

  /** Numbers for the top of the page, plus the filter options. */
  async summary() {
    const db = this.database.db;
    const now = Date.now();
    const [[failed], [failed2fa], [sensitive], users, actors] =
      await Promise.all([
        db
          .select({ n: count() })
          .from(platformAuditLogs)
          .where(
            and(
              eq(platformAuditLogs.action, 'auth.login_failed'),
              gte(platformAuditLogs.createdAt, new Date(now - DAY_MS)),
            ),
          ),
        db
          .select({ n: count() })
          .from(platformAuditLogs)
          .where(
            and(
              eq(platformAuditLogs.action, 'auth.2fa_failed'),
              gte(platformAuditLogs.createdAt, new Date(now - DAY_MS)),
            ),
          ),
        db
          .select({ n: count() })
          .from(platformAuditLogs)
          .where(
            and(
              inArray(platformAuditLogs.action, [...SENSITIVE_ACTIONS]),
              gte(platformAuditLogs.createdAt, new Date(now - 7 * DAY_MS)),
            ),
          ),
        db
          .select({
            id: platformUsers.id,
            name: platformUsers.name,
            twoFactor: platformUsers.totpEnabledAt,
          })
          .from(platformUsers)
          .where(
            and(
              eq(platformUsers.active, true),
              isNotNull(platformUsers.passwordHash),
            ),
          ),
        db
          .selectDistinct({ id: actor.id, name: actor.name })
          .from(platformAuditLogs)
          .innerJoin(actor, eq(actor.id, platformAuditLogs.userId)),
      ]);
    return {
      failedLogins24h: failed.n,
      failedTwoFactor24h: failed2fa.n,
      sensitiveEvents7d: sensitive.n,
      activeUsers: users.length,
      usersWithTwoFactor: users.filter((u) => u.twoFactor).length,
      usersWithoutTwoFactor: users
        .filter((u) => !u.twoFactor)
        .map((u) => ({ id: u.id, name: u.name })),
      categories: Object.entries(AUDIT_CATEGORIES).map(([key, c]) => ({
        key,
        label: c.label,
      })),
      actors: actors.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private rows(where: SQL | undefined, limit: number, offset: number) {
    return this.database.db
      .select({
        id: platformAuditLogs.id,
        action: platformAuditLogs.action,
        entity: platformAuditLogs.entity,
        metadata: platformAuditLogs.metadata,
        ip: platformAuditLogs.ip,
        createdAt: platformAuditLogs.createdAt,
        actor: { id: actor.id, name: actor.name, email: actor.email },
        tenant: { id: tenants.id, name: tenants.name },
        subjectUserId: platformAuditLogs.entityId,
      })
      .from(platformAuditLogs)
      .leftJoin(actor, eq(actor.id, platformAuditLogs.userId))
      .leftJoin(tenants, eq(tenants.id, platformAuditLogs.tenantId))
      .where(where)
      .orderBy(desc(platformAuditLogs.createdAt), desc(platformAuditLogs.id))
      .limit(limit)
      .offset(offset)
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          actor: r.actor?.id ? r.actor : null,
          tenant: r.tenant?.id ? r.tenant : null,
          category: categoryOf(r.action),
          sensitive: (SENSITIVE_ACTIONS as readonly string[]).includes(
            r.action,
          ),
        })),
      );
  }

  private where(q: AuditQuery) {
    const term = q.search?.trim().replace(/[\\%_]/g, '\\$&');
    const category = q.category
      ? AUDIT_CATEGORIES[q.category as AuditCategory]
      : null;
    return and(
      q.from ? gte(platformAuditLogs.createdAt, new Date(q.from)) : undefined,
      q.to
        ? lt(platformAuditLogs.createdAt, new Date(Date.parse(q.to) + DAY_MS))
        : undefined,
      category
        ? or(
            ...category.prefixes.map((p) =>
              ilike(platformAuditLogs.action, `${p}%`),
            ),
          )
        : undefined,
      q.actorId ? eq(platformAuditLogs.userId, q.actorId) : undefined,
      q.tenantId ? eq(platformAuditLogs.tenantId, q.tenantId) : undefined,
      q.sensitive
        ? inArray(platformAuditLogs.action, [...SENSITIVE_ACTIONS])
        : undefined,
      term
        ? or(
            ilike(platformAuditLogs.action, `%${term}%`),
            ilike(actor.name, `%${term}%`),
            ilike(tenants.name, `%${term}%`),
            ilike(platformAuditLogs.ip, `%${term}%`),
            sql`${platformAuditLogs.metadata}::text ilike ${`%${term}%`}`,
          )
        : undefined,
    );
  }
}
