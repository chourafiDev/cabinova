import { type DashboardService, STATUS_LABELS } from './dashboard.service.js';

type Overview = Awaited<ReturnType<DashboardService['overview']>>;

/** A cell for Excel (fr): quoted when needed. */
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const mad = (centimes: number) => (centimes / 100).toFixed(2).replace('.', ',');

/**
 * Module 1 export: the dashboard's figures as one CSV, semicolon-separated
 * with a BOM so Excel (French locale) opens it with accents and columns
 * intact. Sections are separated by a blank line.
 */
export function dashboardCsv(
  o: Overview,
  filters: Record<string, string | undefined>,
) {
  const rows: (string | number | null | undefined)[][] = [
    ['Cabinova — statistiques globales'],
    ['Généré le', o.generatedAt],
    ...Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => [`Filtre ${k}`, v]),
    [],
    ['Indicateur', 'Valeur'],
    ['Cabinets (total)', o.kpis.tenants.total],
    ...Object.entries(o.kpis.tenants.byStatus).map(([s, n]) => [
      `Cabinets — ${STATUS_LABELS[s] ?? s}`,
      n,
    ]),
    ['Nouveaux cabinets (30 jours)', o.kpis.tenants.newLast30Days],
    ['Abonnements en essai', o.kpis.subscriptions.trialing],
    ['Abonnements actifs', o.kpis.subscriptions.active],
    ['Abonnements impayés', o.kpis.subscriptions.pastDue],
    [
      'Essais se terminant sous 7 jours',
      o.kpis.subscriptions.trialsEndingIn7Days,
    ],
    ['Revenu mensuel contractuel (MAD)', mad(o.kpis.subscriptions.mrr)],
    [
      'Revenu mensuel potentiel des essais (MAD)',
      mad(o.kpis.subscriptions.trialMrr),
    ],
    ['Facturé ce mois (MAD)', mad(o.kpis.billing.billedThisMonth)],
    ['Encaissé ce mois (MAD)', mad(o.kpis.billing.collectedThisMonth)],
    ['Impayés (MAD)', mad(o.kpis.billing.unpaid)],
    [],
    ['Mois', 'Nouveaux cabinets', 'Nouveaux abonnements', 'Résiliations'],
    ...o.series.map((m) => [
      m.month,
      m.newTenants,
      m.newSubscriptions,
      m.cancellations,
    ]),
    [],
    ['Offre', 'Cabinets'],
    ...o.breakdowns.plan.map((r) => [r.label, r.value]),
    [],
    ['Ville', 'Cabinets'],
    ...o.breakdowns.city.map((r) => [r.label, r.value]),
    [],
    ['Spécialité', 'Cabinets'],
    ...o.breakdowns.specialty.map((r) => [r.label, r.value]),
  ];
  return `﻿${rows.map((r) => r.map(cell).join(';')).join('\r\n')}\r\n`;
}
