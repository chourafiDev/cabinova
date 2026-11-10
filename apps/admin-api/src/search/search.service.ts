import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.module.js';
import {
  invoices,
  platformUsers,
  promoCodes,
  supportTickets,
  tenantDomains,
  tenants,
} from '../database/schema/index.js';
import { matchesAny } from './match.js';

/** Results per group: the search is for jumping somewhere, not for listing. */
const LIMIT = 5;

export type SearchResults = {
  tenants?: {
    id: string;
    name: string;
    subdomain: string | null;
    city: string | null;
    status: string;
  }[];
  invoices?: {
    id: string;
    number: string;
    amount: number;
    status: string;
    tenantId: string;
    tenantName: string;
  }[];
  tickets?: {
    id: string;
    number: string;
    subject: string;
    status: string;
    priority: string;
    tenantName: string | null;
  }[];
  users?: { id: string; name: string; email: string; active: boolean }[];
  promoCodes?: {
    id: string;
    code: string;
    discountPercent: number;
    active: boolean;
  }[];
};

/**
 * Header search across the platform. Each group is searched only when the
 * user may open what it lists (same permissions as the pages); support
 * agents without support:all only find their tickets and unassigned ones.
 */
@Injectable()
export class SearchService {
  constructor(private readonly database: DatabaseService) {}

  async search(term: string, user: AuthUser): Promise<SearchResults> {
    const can = (permission: string) =>
      (user.permissions as string[]).includes(permission);
    const db = this.database.db;
    const results: SearchResults = {};
    const jobs: Promise<unknown>[] = [];

    if (can('tenants:read')) {
      jobs.push(
        db
          .select({
            id: tenants.id,
            name: tenants.name,
            subdomain: tenantDomains.subdomain,
            city: tenants.city,
            status: tenants.status,
          })
          .from(tenants)
          .leftJoin(tenantDomains, eq(tenantDomains.tenantId, tenants.id))
          .where(
            matchesAny(term, [
              tenants.name,
              tenants.legalName,
              tenants.responsibleName,
              tenants.email,
              tenants.city,
              tenantDomains.subdomain,
            ]),
          )
          .orderBy(tenants.name)
          .limit(LIMIT)
          .then((rows) => (results.tenants = rows)),
      );
    }

    if (can('billing:read')) {
      jobs.push(
        db
          .select({
            id: invoices.id,
            number: invoices.number,
            amount: invoices.amount,
            status: invoices.status,
            tenantId: invoices.tenantId,
            tenantName: tenants.name,
          })
          .from(invoices)
          .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
          .where(matchesAny(term, [invoices.number, tenants.name]))
          .orderBy(desc(invoices.issuedAt))
          .limit(LIMIT)
          .then((rows) => (results.invoices = rows)),
      );
    }

    if (can('support:read')) {
      const visible = can('support:all')
        ? undefined
        : or(
            isNull(supportTickets.assigneeId),
            eq(supportTickets.assigneeId, user.id),
          );
      jobs.push(
        db
          .select({
            id: supportTickets.id,
            number: supportTickets.number,
            subject: supportTickets.subject,
            status: supportTickets.status,
            priority: supportTickets.priority,
            tenantName: tenants.name,
          })
          .from(supportTickets)
          .leftJoin(tenants, eq(tenants.id, supportTickets.tenantId))
          .where(
            and(
              visible,
              matchesAny(term, [
                supportTickets.number,
                supportTickets.subject,
                supportTickets.requesterName,
                tenants.name,
              ]),
            ),
          )
          .orderBy(desc(supportTickets.lastActivityAt))
          .limit(LIMIT)
          .then((rows) => (results.tickets = rows)),
      );
    }

    if (can('users:read')) {
      jobs.push(
        db
          .select({
            id: platformUsers.id,
            name: platformUsers.name,
            email: platformUsers.email,
            active: platformUsers.active,
          })
          .from(platformUsers)
          .where(matchesAny(term, [platformUsers.name, platformUsers.email]))
          .orderBy(platformUsers.name)
          .limit(LIMIT)
          .then((rows) => (results.users = rows)),
      );
    }

    if (can('subscriptions:read')) {
      jobs.push(
        db
          .select({
            id: promoCodes.id,
            code: promoCodes.code,
            discountPercent: promoCodes.discountPercent,
            active: promoCodes.active,
          })
          .from(promoCodes)
          .where(matchesAny(term, [promoCodes.code, promoCodes.description]))
          .orderBy(sql`${promoCodes.active} desc`, promoCodes.code)
          .limit(LIMIT)
          .then((rows) => (results.promoCodes = rows)),
      );
    }

    await Promise.all(jobs);
    return results;
  }
}
