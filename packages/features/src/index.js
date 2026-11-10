// The feature registry — the single list of features the code implements.
//
// To add a feature:
//   1. Add an entry below (key, name, category, description).
//   2. Add its key to FeatureKey in index.d.ts (a test checks they match).
//   3. Gate the feature's code with that key in the clinic app.
//   4. Deploy: admin-api adds it to the catalog at startup, at level "none"
//      in every plan — then choose its plans in the admin.
//
// A key never changes once code uses it. Removing an entry keeps the feature
// in the catalog, marked "Absente du code" and unavailable to every cabinet.
// Name, category and description are written from here on each deploy;
// the admin manages plan levels, exceptions and status (active/beta/off).

/** @type {readonly import('./index.d.ts').FeatureDefinition[]} */
export const FEATURES = Object.freeze([
  {
    key: 'appointments',
    name: 'Gestion des rendez-vous',
    category: 'Agenda',
    description: 'Agenda du cabinet, prise et suivi des rendez-vous.',
  },
  {
    key: 'medical_records',
    name: 'Dossiers médicaux',
    category: 'Dossier patient',
    description: 'Dossier de chaque patient : antécédents, consultations, documents.',
  },
  {
    key: 'prescriptions',
    name: 'Ordonnances',
    category: 'Dossier patient',
    description: 'Rédaction et impression des ordonnances.',
  },
  {
    key: 'advanced_stats',
    name: 'Statistiques avancées',
    category: 'Pilotage',
    description: 'Tableaux de bord d’activité du cabinet.',
  },
  {
    key: 'sms_reminders',
    name: 'Rappels SMS ou WhatsApp',
    category: 'Communication',
    description: 'Rappels de rendez-vous envoyés aux patients.',
  },
  {
    key: 'multi_doctor',
    name: 'Gestion de plusieurs médecins',
    category: 'Organisation',
    description: 'Plusieurs agendas et praticiens dans un même cabinet.',
  },
  {
    key: 'multi_site',
    name: 'Multi-sites',
    category: 'Organisation',
    description: 'Un cabinet réparti sur plusieurs adresses.',
  },
  {
    key: 'priority_support',
    name: 'Support prioritaire',
    category: 'Service',
    description: 'Délais de première réponse du support raccourcis.',
  },
]);

/** Every implemented key, in display order. */
export const FEATURE_KEYS = Object.freeze(FEATURES.map((f) => f.key));

/** True when `key` is implemented by the code (narrows to FeatureKey). */
export function isFeatureKey(key) {
  return FEATURE_KEYS.includes(key);
}
