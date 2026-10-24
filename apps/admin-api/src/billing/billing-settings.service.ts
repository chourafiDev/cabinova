import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import { platformSettings } from '../database/schema/index.js';
import type { BillingSettingsDto } from './dto.js';

export type BillingSettings = Omit<BillingSettingsDto, never>;

const KEY = 'billing';

/** Defaults until the Super Admin fills in the RIB. */
const DEFAULTS = { graceDays: 7, invoiceDaysBefore: 7 };

/** The issuer and RIB printed on invoices (platform_settings "billing"). */
@Injectable()
export class BillingSettingsService {
  constructor(private readonly database: DatabaseService) {}

  /** null until configured: invoices still go out, without bank details. */
  async get(
    tx: Database | Transaction = this.database.db,
  ): Promise<
    | (BillingSettings & { configured: true })
    | (typeof DEFAULTS & { configured: false })
  > {
    const [row] = await tx
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, KEY));
    return row
      ? { ...(row.value as BillingSettings), configured: true }
      : { ...DEFAULTS, configured: false };
  }

  async update(actor: AuditActor, dto: BillingSettingsDto) {
    return this.database.db.transaction(async (tx) => {
      const before = await this.get(tx);
      // Plain object for the jsonb column (dto is a class instance).
      const value: BillingSettings = JSON.parse(
        JSON.stringify(dto),
      ) as BillingSettings;
      await tx
        .insert(platformSettings)
        .values({ key: KEY, value, updatedBy: actor.userId })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value, updatedBy: actor.userId, updatedAt: new Date() },
        });
      const changes = diff(
        before as Record<string, unknown>,
        value as Record<string, unknown>,
        Object.keys(value),
      );
      if (Object.keys(changes).length) {
        await writeAudit(tx, actor, {
          action: 'settings.billing.update',
          entity: 'settings',
          entityId: '00000000-0000-0000-0000-000000000000',
          // The full RIB isn't repeated in the audit trail.
          metadata: { fields: Object.keys(changes) },
        });
      }
      return { ...value, configured: true as const };
    });
  }
}
