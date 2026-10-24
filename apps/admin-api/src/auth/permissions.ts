// Platform permission catalog and default central roles (Module 5 of
// "Partie super admin"). Keep PLATFORM_PERMISSIONS in sync with
// apps/admin-web/src/lib/permissions.ts.
//
// Only Dashboard and Cabinets (tenants:*) ship with real pages in this
// pass; the rest of the catalog exists now so the role model doesn't need
// reshaping every time a module is built.

export const PLATFORM_PERMISSIONS = {
  'dashboard:read': 'Voir le tableau de bord global',
  'tenants:read': 'Voir les cabinets',
  'tenants:write': 'Créer et gérer les cabinets',
  'subscriptions:read': 'Voir les abonnements',
  'subscriptions:write': 'Gérer les offres et abonnements',
  'billing:read': 'Voir la facturation',
  'billing:write': 'Gérer les factures et paiements',
  'technical:read': "Voir l'état technique des tenants",
  'technical:write': 'Provisionner, migrer, sauvegarder les tenants',
  'users:read': 'Voir les utilisateurs de la plateforme',
  'users:write': 'Gérer les utilisateurs et permissions de la plateforme',
  'support:read': 'Voir les tickets de support',
  'support:write': 'Traiter les tickets de support',
  'security:read': "Voir le journal d'audit et les événements sensibles",
  'settings:read': 'Voir la configuration globale',
  'settings:write': 'Modifier la configuration globale',
} as const;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

const ALL = Object.keys(PLATFORM_PERMISSIONS) as PlatformPermission[];

/**
 * The platform's three central roles — the only ones that exist. Their
 * permissions can be adjusted from Utilisateurs → Rôles et permissions
 * (except Super Admin, which always has everything); roles can't be added
 * or removed. `pnpm db:seed` creates them and removes any other unused role.
 */
export const DEFAULT_PLATFORM_ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: PlatformPermission[];
}[] = [
  {
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Administration globale de la plateforme',
    permissions: ALL,
  },
  {
    key: 'support_agent',
    name: 'Agent de Support',
    description: 'Diagnostic et assistance aux cabinets',
    permissions: [
      'dashboard:read',
      'tenants:read',
      'support:read',
      'support:write',
    ],
  },
  {
    key: 'technical_agent',
    name: 'Agent technique',
    description: 'Bases de données, migrations et sauvegardes',
    permissions: [
      'dashboard:read',
      'tenants:read',
      'technical:read',
      'technical:write',
    ],
  },
];
