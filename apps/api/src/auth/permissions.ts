// Permission catalog and default roles. Source of truth: synced to the
// `permissions` / `roles` / `role_permissions` tables by `pnpm db:seed`.
// Keep PERMISSIONS in sync with apps/web/src/lib/permissions.ts.

export const PERMISSIONS = {
  'dashboard:read': 'Voir le tableau de bord',
  'appointments:read': "Voir l'agenda",
  'appointments:write': 'Gérer les rendez-vous',
  'patients:read': 'Voir les patients',
  'patients:write': 'Créer et modifier les patients',
  'patients:delete': 'Supprimer des dossiers patients sans historique',
  'emr:read': 'Voir les dossiers médicaux',
  'emr:write': 'Rédiger dans les dossiers médicaux',
  'documents:read': 'Voir les ordonnances et documents',
  'documents:write': 'Créer des ordonnances et documents',
  'billing:read': 'Voir la facturation',
  'billing:write': 'Facturer et encaisser',
  'reports:read': 'Voir les rapports',
  'users:read': "Voir l'équipe",
  'users:write': "Gérer l'équipe et les permissions",
  'settings:read': 'Voir les réglages',
  'settings:write': 'Modifier les réglages',
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as Permission[];

/** Roles seeded at setup; the platform super-admin edits them afterwards. */
export const DEFAULT_ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: 'clinic_admin',
    name: 'Administrateur',
    description: 'Propriétaire ou directeur de la clinique',
    permissions: ALL,
  },
  {
    key: 'doctor',
    name: 'Médecin',
    description: 'Praticien : agenda, consultations, prescriptions',
    permissions: [
      'dashboard:read',
      'appointments:read',
      'appointments:write',
      'patients:read',
      'patients:write',
      'emr:read',
      'emr:write',
      'documents:read',
      'documents:write',
    ],
  },
  {
    key: 'nurse',
    name: 'Infirmier / assistant',
    description: 'Constantes, triage, préparation du patient',
    permissions: [
      'dashboard:read',
      'appointments:read',
      'patients:read',
      'patients:write',
      'emr:read',
      'emr:write',
    ],
  },
  {
    key: 'receptionist',
    name: 'Réceptionniste',
    description: 'Accueil : rendez-vous, enregistrement, encaissement',
    permissions: [
      'dashboard:read',
      'appointments:read',
      'appointments:write',
      'patients:read',
      'patients:write',
      'documents:read',
      'billing:read',
      'billing:write',
    ],
  },
  {
    key: 'accountant',
    name: 'Comptable',
    description: 'Factures, paiements, rapports financiers',
    permissions: [
      'dashboard:read',
      'patients:read',
      'billing:read',
      'billing:write',
      'reports:read',
    ],
  },
];
