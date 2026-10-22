import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';

// Control-plane table: no tenant_id, no RLS.

export const tenantStatus = pgEnum('tenant_status', [
  'trial',
  'active',
  'suspended',
  'archived',
]);

export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  /** Subdomain: <slug>.cabinova.ma */
  slug: text('slug').notNull().unique(),
  customDomain: text('custom_domain').unique(),
  status: tenantStatus('status').notNull().default('trial'),
  country: text('country').notNull().default('MA'),
  locale: text('locale').notNull().default('fr'),
  timezone: text('timezone').notNull().default('Africa/Casablanca'),
  ...timestamps,
});
