import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
} from 'drizzle-orm';
import { DatabaseService } from '../database/database.module.js';
import { auditLogs, users } from '../database/schema/index.js';
import type { ListAuditLogsQuery } from './dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const like = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  list(query: ListAuditLogsQuery) {
    const term = query.search?.trim();
    const where = and(
      query.entity
        ? inArray(auditLogs.entity, query.entity.split(','))
        : undefined,
      term
        ? or(ilike(users.name, like(term)), ilike(users.email, like(term)))
        : undefined,
      query.from ? gte(auditLogs.createdAt, new Date(query.from)) : undefined,
      // `to` is the picked day's start (local midnight): include the whole
      // day by moving to just before the next one.
      query.to
        ? lte(
            auditLogs.createdAt,
            new Date(new Date(query.to).getTime() + DAY_MS - 1),
          )
        : undefined,
    );

    return this.database.tenant(async (tx) => {
      const base = tx
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entity: auditLogs.entity,
          entityId: auditLogs.entityId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId));

      const [rows, [{ total }]] = await Promise.all([
        base
          .where(where)
          .orderBy(desc(auditLogs.createdAt), asc(auditLogs.id))
          .limit(query.perPage)
          .offset((query.page - 1) * query.perPage),
        tx
          .select({ total: count() })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.userId))
          .where(where),
      ]);
      return {
        data: rows,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      };
    });
  }
}
