import {
  assertSuperAdminRemains,
  assertWithin,
  effectivePermissions,
} from './access-rules.js';

describe('platform access rules', () => {
  it('applies grants then denies on top of role permissions', () => {
    expect(
      effectivePermissions(['tenants:read', 'tenants:write'], {
        'billing:read': 'grant',
        'tenants:write': 'deny',
      }),
    ).toEqual(['billing:read', 'tenants:read']);
  });

  it('refuses granting a permission the actor lacks', () => {
    expect(() =>
      assertWithin(['users:write', 'tenants:read'], ['settings:write'], 'Rôle'),
    ).toThrow(/settings:write/);
    expect(() =>
      assertWithin(['users:write', 'tenants:read'], ['tenants:read'], 'Rôle'),
    ).not.toThrow();
  });

  it('keeps at least one active Super Admin', () => {
    expect(() => assertSuperAdminRemains(0)).toThrow();
    expect(() => assertSuperAdminRemains(1)).not.toThrow();
  });
});
