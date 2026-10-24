import { ForbiddenException } from '@nestjs/common';
import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from '../auth/permissions.js';

// Module 5 — rules that keep platform access safe whoever edits it.

export const SUPER_ADMIN_ROLE = 'super_admin';

export type OverrideEffect = 'grant' | 'deny';

export const isPermission = (key: string): key is PlatformPermission =>
  key in PLATFORM_PERMISSIONS;

/** Role defaults + user grants − user denies (same rule as AuthService). */
export function effectivePermissions(
  fromRoles: Iterable<string>,
  overrides: Record<string, OverrideEffect>,
) {
  const effective = new Set(fromRoles);
  for (const [key, effect] of Object.entries(overrides)) {
    if (effect === 'grant') effective.add(key);
    else effective.delete(key);
  }
  return [...effective].sort() as PlatformPermission[];
}

/**
 * No escalation: nobody hands out — or manages someone holding — a
 * permission they don't have themselves. With it, a user who can manage
 * users still can't make themselves (or a friend) Super Admin.
 */
export function assertWithin(
  actorPermissions: readonly string[],
  permissions: Iterable<string>,
  what: string,
) {
  const missing = [...permissions].filter((p) => !actorPermissions.includes(p));
  if (missing.length) {
    throw new ForbiddenException({
      code: 'ESCALATION',
      message: `${what} : vous ne pouvez pas attribuer ou gérer des permissions que vous n'avez pas (${missing.join(', ')}).`,
      missing,
    });
  }
}

/**
 * The platform must always keep one active Super Admin: `remaining` is the
 * number of active Super Admins left once the change is applied.
 */
export function assertSuperAdminRemains(remaining: number) {
  if (remaining < 1) {
    throw new ForbiddenException({
      code: 'LAST_SUPER_ADMIN',
      message:
        'Impossible : la plateforme doit garder au moins un Super Admin actif.',
    });
  }
}
