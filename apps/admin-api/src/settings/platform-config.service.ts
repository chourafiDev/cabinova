import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import { DatabaseService } from '../database/database.module.js';
import { platformSettings } from '../database/schema/index.js';
import type {
  EmailSettingsDto,
  GeneralSettingsDto,
  LanguageSettingsDto,
  NotificationSettingsDto,
} from './dto.js';

// Configuration globale — paramètres généraux, e-mails, notifications,
// langues, identité visuelle. Paiements (RIB, délais) stay in
// billing-settings.service.ts (key "billing"). Each section is one
// platform_settings row, merged over the defaults below, so a missing row
// or a new field never breaks a reader.

type Plain<T> = { [K in keyof T]: T[K] };
export type GeneralSettings = Plain<GeneralSettingsDto>;
export type EmailSettings = Plain<EmailSettingsDto>;
export type NotificationSettings = {
  cabinets: Plain<NotificationSettingsDto['cabinets']>;
  team: Plain<NotificationSettingsDto['team']>;
};
export type LanguageSettings = Plain<LanguageSettingsDto>;
export type BrandingSettings = { primaryColor: string; logo: string | null };

export type Sections = {
  general: GeneralSettings;
  email: EmailSettings;
  notifications: NotificationSettings;
  languages: LanguageSettings;
  branding: BrandingSettings;
};
export type SectionKey = keyof Sections;
export const SECTION_KEYS: SectionKey[] = [
  'general',
  'email',
  'notifications',
  'languages',
  'branding',
];

export const DEFAULTS: Sections = {
  general: {
    platformName: 'Cabinova',
    supportEmail: null,
    supportPhone: null,
    websiteUrl: null,
    defaultTimezone: 'Africa/Casablanca',
  },
  email: {
    senderName: 'Cabinova',
    senderAddress: null,
    replyTo: null,
    signature: null,
  },
  notifications: {
    cabinets: {
      trialEnding: true,
      invoiceIssued: true,
      invoiceOverdue: true,
      paymentReceipt: true,
    },
    team: {
      recipients: [],
      incidents: true,
      databaseUnreachable: true,
      invoiceOverdue: false,
    },
  },
  languages: { defaultLanguage: 'fr', available: ['fr'] },
  branding: { primaryColor: '#613f75', logo: null },
};

const CACHE_MS = 30_000;
/** Stored key per section ("settings.general"…), apart from "billing"/"compliance". */
const rowKey = (section: SectionKey) => `settings.${section}`;

/**
 * Typed access to the global configuration. Readers (e-mails, invoices,
 * tenant creation, alerts) call `get`; values are cached 30 s per instance
 * and refreshed at once on update.
 */
@Injectable()
export class PlatformConfigService {
  private cache: { at: number; value: Sections } | null = null;

  constructor(private readonly database: DatabaseService) {}

  async all(): Promise<Sections> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.value;
    }
    const rows = await this.database.db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(inArray(platformSettings.key, SECTION_KEYS.map(rowKey)));
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const value = Object.fromEntries(
      SECTION_KEYS.map((k) => [k, merge(DEFAULTS[k], stored.get(rowKey(k)))]),
    ) as Sections;
    this.cache = { at: Date.now(), value };
    return value;
  }

  async get<K extends SectionKey>(section: K): Promise<Sections[K]> {
    return (await this.all())[section];
  }

  /** Replaces one section; audits which fields changed (values for non-secret ones). */
  async update<K extends SectionKey>(
    actor: AuditActor,
    section: K,
    input: Partial<Sections[K]>,
  ) {
    const before = await this.fresh(section);
    // Plain JSON (DTOs are class instances); undefined keeps the current value.
    const next = {
      ...before,
      ...(JSON.parse(JSON.stringify(input)) as Partial<Sections[K]>),
    } as Sections[K];
    if (section === 'languages') {
      const l = next as LanguageSettings;
      l.available = [...new Set([l.defaultLanguage, ...l.available])];
    }
    if (section === 'notifications') {
      const n = next as NotificationSettings;
      n.team.recipients = [
        ...new Set(n.team.recipients.map((r) => r.trim().toLowerCase())),
      ];
    }
    const changes = diff(
      before as Record<string, unknown>,
      next as Record<string, unknown>,
      Object.keys(next),
    );
    if (Object.keys(changes).length) {
      await this.database.db.transaction(async (tx) => {
        await tx
          .insert(platformSettings)
          .values({
            key: rowKey(section),
            value: next,
            updatedBy: actor.userId,
          })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: {
              value: next,
              updatedBy: actor.userId,
              updatedAt: new Date(),
            },
          });
        await writeAudit(tx, actor, {
          action: `settings.${section}.update`,
          entity: 'settings',
          entityId: null,
          // The logo itself is never copied into the journal.
          metadata: {
            changes:
              section === 'branding' && changes.logo
                ? {
                    ...changes,
                    logo: {
                      from: (before as BrandingSettings).logo ? 'logo' : null,
                      to: (next as BrandingSettings).logo
                        ? 'nouveau logo'
                        : null,
                    },
                  }
                : changes,
          },
        });
      });
      this.cache = null;
    }
    return this.publicSection(section, next);
  }

  /** Everything the settings page shows (the logo as a URL, not inline). */
  async forPage() {
    const all = await this.all();
    const updated = await this.lastUpdates();
    return {
      ...Object.fromEntries(
        SECTION_KEYS.map((k) => [k, this.publicSection(k, all[k])]),
      ),
      updatedAt: updated,
    };
  }

  /** Name, colour and logo for the sign-in page, sidebar, invoices and e-mails. */
  async branding() {
    const [general, branding] = await Promise.all([
      this.get('general'),
      this.get('branding'),
    ]);
    return {
      platformName: general.platformName,
      primaryColor: branding.primaryColor,
      logoUrl: branding.logo
        ? `/branding/logo?v=${logoVersion(branding.logo)}`
        : null,
    };
  }

  async logo() {
    const { logo } = await this.get('branding');
    const match = logo && /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(logo);
    return match
      ? { contentType: match[1], data: Buffer.from(match[2], 'base64') }
      : null;
  }

  private publicSection<K extends SectionKey>(section: K, value: Sections[K]) {
    if (section !== 'branding') return value;
    const b = value as BrandingSettings;
    return {
      primaryColor: b.primaryColor,
      logoUrl: b.logo ? `/branding/logo?v=${logoVersion(b.logo)}` : null,
    };
  }

  private async fresh<K extends SectionKey>(section: K) {
    const [row] = await this.database.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, rowKey(section)));
    return merge(DEFAULTS[section], row?.value);
  }

  private async lastUpdates() {
    const rows = await this.database.db
      .select({ key: platformSettings.key, at: platformSettings.updatedAt })
      .from(platformSettings)
      .where(inArray(platformSettings.key, SECTION_KEYS.map(rowKey)));
    return Object.fromEntries(
      rows.map((r) => [r.key.replace('settings.', ''), r.at]),
    );
  }
}

/** Short hash so browsers and mail clients refetch a changed logo. */
const logoVersion = (logo: string) =>
  createHash('sha256').update(logo).digest('hex').slice(0, 10);

/** Stored value over defaults, one level of nesting deep (notifications). */
function merge<T>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== 'object') return structuredClone(defaults);
  const out = structuredClone(defaults) as Record<string, unknown>;
  for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
    const d = out[k];
    out[k] =
      d &&
      typeof d === 'object' &&
      !Array.isArray(d) &&
      v &&
      typeof v === 'object'
        ? { ...(d as object), ...(v as object) }
        : v;
  }
  return out as T;
}
