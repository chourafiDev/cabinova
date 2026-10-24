// Module 3 + "Fonctionnalités et options" — the features a plan can include
// and the three default plans seeded by `pnpm db:seed` (the matrix of
// "Partie super admin"). Prices and limits are illustrative; edit them from
// the Offres page. The feature catalog itself lives in the `features` table
// (created, put in beta or switched off from the Fonctionnalités page);
// DEFAULT_FEATURES only seeds it. Keep FEATURE_LEVELS in sync with
// apps/admin-web/src/lib/features.ts.

/** Clinic-side modules, seeded once; the catalog is then managed in the UI. */
export const DEFAULT_FEATURES = [
  {
    key: 'appointments',
    name: 'Gestion des rendez-vous',
    category: 'Agenda',
    sortOrder: 1,
  },
  {
    key: 'medical_records',
    name: 'Dossiers médicaux',
    category: 'Dossier patient',
    sortOrder: 2,
  },
  {
    key: 'prescriptions',
    name: 'Ordonnances',
    category: 'Dossier patient',
    sortOrder: 3,
  },
  {
    key: 'advanced_stats',
    name: 'Statistiques avancées',
    category: 'Pilotage',
    sortOrder: 4,
  },
  {
    key: 'sms_reminders',
    name: 'Rappels SMS ou WhatsApp',
    category: 'Communication',
    sortOrder: 5,
  },
  {
    key: 'multi_doctor',
    name: 'Gestion de plusieurs médecins',
    category: 'Organisation',
    sortOrder: 6,
  },
  {
    key: 'multi_site',
    name: 'Multi-sites',
    category: 'Organisation',
    sortOrder: 7,
  },
  {
    key: 'priority_support',
    name: 'Support prioritaire',
    category: 'Service',
    sortOrder: 8,
  },
] as const;

/**
 * included — available without limit
 * limited  — available with a usage cap (e.g. SMS per month)
 * addon    — available as a paid option
 * custom   — tailored per contract (Enterprise)
 * none     — not available
 */
export const FEATURE_LEVELS = [
  'included',
  'limited',
  'addon',
  'custom',
  'none',
] as const;
export type FeatureLevel = (typeof FEATURE_LEVELS)[number];

/** Level per feature key; a feature missing from a plan counts as "none". */
export type PlanFeatures = Record<string, FeatureLevel>;

/** Amounts in centimes (MAD). NULL limit = unlimited. */
export const DEFAULT_PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Un médecin, l’essentiel du cabinet.',
    priceMonthly: 29_900,
    priceAnnual: 299_000,
    trialDays: 7,
    maxDoctors: 1,
    maxSecretaries: 1,
    maxUsers: 2,
    storageQuotaMb: 5 * 1024,
    sortOrder: 1,
    features: {
      appointments: 'included',
      medical_records: 'included',
      prescriptions: 'included',
      advanced_stats: 'none',
      sms_reminders: 'none',
      multi_doctor: 'none',
      multi_site: 'none',
      priority_support: 'none',
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'Statistiques avancées et rappels patients.',
    priceMonthly: 59_900,
    priceAnnual: 599_000,
    trialDays: 7,
    maxDoctors: 1,
    maxSecretaries: 3,
    maxUsers: 4,
    storageQuotaMb: 20 * 1024,
    sortOrder: 2,
    features: {
      appointments: 'included',
      medical_records: 'included',
      prescriptions: 'included',
      advanced_stats: 'included',
      sms_reminders: 'limited',
      multi_doctor: 'none',
      multi_site: 'addon',
      priority_support: 'none',
    },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Plusieurs médecins et sites, support prioritaire.',
    priceMonthly: 119_900,
    priceAnnual: 1_199_000,
    trialDays: 7,
    maxDoctors: null,
    maxSecretaries: 10,
    maxUsers: null,
    storageQuotaMb: 100 * 1024,
    sortOrder: 3,
    features: {
      appointments: 'included',
      medical_records: 'included',
      prescriptions: 'custom',
      advanced_stats: 'included',
      sms_reminders: 'included',
      multi_doctor: 'included',
      multi_site: 'included',
      priority_support: 'included',
    },
  },
] satisfies {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  trialDays: number;
  maxDoctors: number | null;
  maxSecretaries: number | null;
  maxUsers: number | null;
  storageQuotaMb: number | null;
  sortOrder: number;
  features: PlanFeatures;
}[];
