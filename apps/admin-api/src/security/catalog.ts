// Sécurité et conformité — how audit actions are grouped and which ones
// count as sensitive (access, money, data, permissions). Keep in sync with
// apps/admin-web/src/lib/security.ts.

export const AUDIT_CATEGORIES = {
  auth: { label: 'Connexions', prefixes: ['auth.'] },
  tenants: {
    label: 'Cabinets',
    prefixes: [
      'tenant.create',
      'tenant.update',
      'tenant.status',
      'tenant.feature',
      'tenant.provision',
      'tenant.database',
    ],
  },
  data: { label: 'Données', prefixes: ['tenant.data.'] },
  billing: { label: 'Facturation', prefixes: ['billing.', 'settings.billing'] },
  plans: { label: 'Offres', prefixes: ['plan.'] },
  features: { label: 'Fonctionnalités', prefixes: ['feature.'] },
  support: { label: 'Support', prefixes: ['support.'] },
  settings: {
    label: 'Configuration',
    prefixes: [
      'settings.general',
      'settings.email',
      'settings.notifications',
      'settings.languages',
      'settings.branding',
      'settings.compliance',
    ],
  },
  users: {
    label: 'Utilisateurs',
    prefixes: ['platform_user.', 'platform_role.'],
  },
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

/** Actions shown with a "sensible" flag and counted on the security page. */
export const SENSITIVE_ACTIONS = [
  'auth.login_failed',
  'auth.2fa_failed',
  'auth.2fa.disable',
  'auth.2fa.recovery_used',
  'platform_user.2fa_reset',
  'platform_user.invite',
  'platform_user.update',
  'platform_user.deactivate',
  'platform_role.update',
  'tenant.status.apply',
  'tenant.data.export',
  'tenant.data.delete',
  'feature.status.disabled',
  'settings.billing.update',
  'settings.email.update',
  'settings.notifications.update',
  'billing.invoice.void',
  'billing.payment.record',
  'billing.credit_note.issue',
] as const;

export const categoryOf = (action: string): AuditCategory | null => {
  for (const [key, c] of Object.entries(AUDIT_CATEGORIES) as [
    AuditCategory,
    (typeof AUDIT_CATEGORIES)[AuditCategory],
  ][]) {
    if (c.prefixes.some((p) => action.startsWith(p))) return key;
  }
  return null;
};
