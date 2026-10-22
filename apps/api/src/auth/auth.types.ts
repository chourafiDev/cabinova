import type { Permission } from './permissions.js';

/** `req.user` on authenticated requests. */
export type AuthUser = {
  id: string;
  tenantId: string;
  sessionId: string;
  email: string;
  name: string;
  roles: { key: string; name: string }[];
  /** Role defaults + user grants − user denies. */
  permissions: Permission[];
};
