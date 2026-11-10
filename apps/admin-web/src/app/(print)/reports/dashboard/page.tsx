import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getBranding } from "@/lib/branding";
import { type DashboardOverview, dashboardQuery, PERIODS } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { STATUS_LABELS, type TenantStatus } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { PrintButton } from "../../invoices/[id]/print-button";

export const metadata = { title: "Rapport — statistiques" };

const SEVERITY = { critical: "Critique", warning: "À surveiller", info: "Information" } as const;

/**
 * The dashboard as a document (print / "Enregistrer en PDF"): same figures
 * and filters as the dashboard, laid out as tables. Billed, collected and
 * unpaid amounts stay separate, as the spec requires.
 */
export default async function DashboardReportPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "dashboard:read")) notFound();
	const params = await searchParams;
	const [data, branding] = await Promise.all([
		apiGet<DashboardOverview>(`/dashboard?${dashboardQuery(params)}`),
		getBranding(),
	]);
	const k = data.kpis;
	const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
	const filters = [
		["Période de création", PERIODS[get("period") ?? "all"]?.label],
		["Statut", get("status") && STATUS_LABELS[get("status") as TenantStatus]],
		["Ville", get("city")],
		["Spécialité", get("specialty")],
		["Offre", get("plan") && (data.filters.plans.find((p) => p.key === get("plan"))?.name ?? get("plan"))],
	].filter((f): f is [string, string] => !!f[1]);

	const th = "border-b py-1.5 text-start text-xs font-medium text-zinc-500";
	const td = "border-b border-zinc-100 py-1.5";
	const num = "text-end tabular-nums";
	const section = "mb-8 break-inside-avoid";

	const breakdown = (title: string, rows: DashboardOverview["breakdowns"]["plan"]) => {
		const total = rows.reduce((a, r) => a + r.value, 0);
		return (
			<div className="break-inside-avoid">
				<h3 className="mb-1 text-sm font-semibold">{title}</h3>
				<table className="w-full text-sm">
					<tbody>
						{rows.map((r) => (
							<tr key={r.label}>
								<td className={td}>{r.label}</td>
								<td className={cn(td, num)}>{r.value}</td>
								<td className={cn(td, num, "w-14 text-zinc-500")}>{total ? Math.round((r.value / total) * 100) : 0} %</td>
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td className={cn(td, "text-zinc-500")}>Aucune donnée</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-4xl px-4 print:max-w-none print:px-0">
			<div className="mb-4 flex justify-end print:hidden">
				<PrintButton />
			</div>
			<article className="paper rounded-xl border bg-white p-10 text-sm text-zinc-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
				<header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
					<div className="flex items-center gap-2">
						<BrandMark branding={branding} className="font-bold" />
						<div className="grid leading-tight">
							<span className="text-lg font-bold">Statistiques de la plateforme</span>
							<span className="text-xs text-zinc-500">{branding.platformName}</span>
						</div>
					</div>
					<div className="grid text-end text-xs text-zinc-500">
						<span>Généré le {formatDate(data.generatedAt, { hour: "2-digit", minute: "2-digit" })}</span>
						<span>par {session.user.name}</span>
					</div>
				</header>

				<p className="mb-6 text-xs text-zinc-600">
					<span className="font-medium">Filtres :</span>{" "}
					{filters.length ? filters.map(([l, v]) => `${l} : ${v}`).join(" · ") : "aucun (toute la plateforme)"}.
					Les alertes concernent toujours toute la plateforme.
				</p>

				<section className={section}>
					<h2 className="mb-3 font-semibold">Indicateurs</h2>
					<div className="grid grid-cols-3 gap-3">
						{[
							["Cabinets", String(k.tenants.total), `${k.tenants.newLast30Days} nouveaux sur 30 jours`],
							["Abonnements actifs", String(k.subscriptions.active), `${k.subscriptions.trialing} en essai · ${k.subscriptions.pastDue} en attente de paiement`],
							["Revenu mensuel récurrent", formatPrice(k.subscriptions.mrr), "contractuel, hors essais"],
							["Facturé ce mois", formatPrice(k.billing.billedThisMonth), `${k.billing.invoiceCount} facture(s)`],
							["Encaissé ce mois", formatPrice(k.billing.collectedThisMonth), "virements enregistrés"],
							["Impayés", formatPrice(k.billing.unpaid), `${k.billing.unpaidCount} facture(s)`],
						].map(([label, value, hint]) => (
							<div key={label} className="rounded-lg border p-3">
								<div className="text-xs text-zinc-500">{label}</div>
								<div className="text-lg font-semibold tabular-nums">{value}</div>
								<div className="text-[11px] text-zinc-500">{hint}</div>
							</div>
						))}
					</div>
					<p className="mt-2 text-[11px] text-zinc-500">
						Montants facturés, encaissés et impayés distincts : ils ne s’additionnent pas.
					</p>
				</section>

				<section className={section}>
					<h2 className="mb-2 font-semibold">Cabinets par statut</h2>
					<table className="w-full text-sm">
						<tbody>
							{(Object.keys(STATUS_LABELS) as TenantStatus[]).map((s) => (
								<tr key={s}>
									<td className={td}>{STATUS_LABELS[s]}</td>
									<td className={cn(td, num)}>{k.tenants.byStatus[s] ?? 0}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				<section className={section}>
					<h2 className="mb-2 font-semibold">Évolution mensuelle</h2>
					<table className="w-full text-sm">
						<thead>
							<tr>
								<th className={th}>Mois</th>
								<th className={cn(th, "text-end")}>Nouveaux cabinets</th>
								<th className={cn(th, "text-end")}>Nouveaux abonnements</th>
								<th className={cn(th, "text-end")}>Résiliations</th>
							</tr>
						</thead>
						<tbody>
							{data.series.map((m) => (
								<tr key={m.month}>
									<td className={td}>{formatDate(`${m.month}-01T12:00:00Z`, { day: undefined, month: "long" })}</td>
									<td className={cn(td, num)}>{m.newTenants}</td>
									<td className={cn(td, num)}>{m.newSubscriptions}</td>
									<td className={cn(td, num)}>{m.cancellations}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				<section className={cn(section, "grid grid-cols-3 gap-6")}>
					{breakdown("Par offre", data.breakdowns.plan)}
					{breakdown("Par ville", data.breakdowns.city)}
					{breakdown("Par spécialité", data.breakdowns.specialty)}
				</section>

				<section className="break-inside-avoid">
					<h2 className="mb-2 font-semibold">Alertes</h2>
					{data.alerts.length === 0 ? (
						<p className="text-zinc-500">Aucune alerte.</p>
					) : (
						<ul className="grid gap-2">
							{data.alerts.map((a) => (
								<li key={a.key}>
									<span className="font-medium">
										{a.title} ({a.count})
									</span>{" "}
									<span className="text-xs text-zinc-500">— {SEVERITY[a.severity]}</span>
									<ul className="ms-4 list-disc text-xs text-zinc-600">
										{a.items.map((i) => (
											<li key={(i.href ?? "") + i.name}>
												{i.name}
												{i.detail && ` — ${i.detail}`}
											</li>
										))}
										{a.count > a.items.length && <li>… et {a.count - a.items.length} autre(s)</li>}
									</ul>
								</li>
							))}
						</ul>
					)}
				</section>
			</article>
		</div>
	);
}
