import { AsyncLocalStorage } from 'node:async_hooks';
import type { tenants } from '../database/schema/index.js';

export type Tenant = Pick<
  typeof tenants.$inferSelect,
  'id' | 'name' | 'slug' | 'status' | 'locale' | 'timezone'
>;

const storage = new AsyncLocalStorage<Tenant>();

/** Runs the rest of the request with `tenant` as the current tenant. */
export function runWithTenant<T>(tenant: Tenant, fn: () => T): T {
  return storage.run(tenant, fn);
}

/** Tenant of the current request (resolved from the host by TenantMiddleware). */
export function currentTenant(): Tenant {
  const tenant = storage.getStore();
  if (!tenant) throw new Error('No tenant in the current request context');
  return tenant;
}
