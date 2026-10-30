import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HiChartBar } from "react-icons/hi2";
import { COVERAGE_LABELS, type Coverage } from "@/lib/patients";
import {
	DEFAULT_PRESET,
	formatRate,
	periodLabel,
	PRESETS,
	type PresetKey,
	type Report,
	WEEKDAYS,
} from "@/lib/reports";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { AffluenceHeatmap } from "./_components/affluence-heatmap";
import { Bars } from "./_components/bars";
import { ChartPanel } from "./_components/chart-panel";
import { Panel } from "./_components/panel";
import { ReportsFilters } from "./_components/reports-filters";
import { ReportsShell } from "./_components/reports-shell";
import { ReportsTabs } from "./_components/reports-tabs";
import { RevenueChart, RevenueTable } from "./_components/revenue-chart";
import { SeriesChart, SeriesTable } from "./_components/series-chart";
import { StatCard } from "./_components/stat-card";
import { mad, METHOD_LABELS } from "@/lib/payments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const span = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
/** Rate change in points, e.g. 8 % → 5 % = -3 pts. */
const points = (now: number | null, before: number | null) =>
	now === null || before === null ? null : Math.round(now - before);

/** The period from the URL: a preset (default 30 days to today) or ?du=&au= (a year at most). */
function periodOf(params: Record<string, string | string[] | undefined>) {
	const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
	const from = one(params.du);
	const to = one(params.au);
	if (from && to && DAY.test(from) && DAY.test(to) && span(from, to) >= 1 && span(from, to) <= 366) {
		return { preset: null, from, to };
	}
	const preset = PRESETS.find((p) => p.key === one(params.periode)) ?? PRESETS.find((p) => p.key === DEFAULT_PRESET)!;
	const end = today();
	return { preset: preset.key as PresetKey, from: addDays(end, 1 - preset.days), to: end };
}

/** Statistiques: what the agenda says about a period, for the responsible doctor and the doctors. */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
	const state = await getClinicState();
	if (state.status !== "signed-in" || !["owner", "doctor"].includes(state.session.user.role)) notFound();
	const { user } = state.session;
	const params = await searchParams;
	const { preset, from, to } = periodOf(params);
	const query = new URLSearchParams({ from, to });
	for (const [param, key] of [
		["espace", "space"],
		["medecin", "practitioner"],
	] as const) {
		const v = params[param];
		if (typeof v === "string" && v) query.set(key, v);
	}
	const report = await apiGet<Report>(`/reports?${query}`);
	const { activity, patients, period } = report;
	const t = activity.totals;
	const { revenue, affluence } = report;
	const seenTotal = patients.sex.male + patients.sex.female;
	const empty = t.appointments + t.cancelled === 0;
	const bucketName = { day: "Jour", week: "Semaine", month: "Mois" }[period.bucket];
	const space = report.filters.space && report.filters.spaces.find((s) => s.id === report.filters.space);
	const series = activity.series;
	const busiest = affluence.heatmap.reduce<(typeof affluence.heatmap)[number] | null>(
		(top, c) => (c.count > (top?.count ?? 0) ? c : top),
		null,
	);
	const median = affluence.leadTimes.median;
	const leadTotal = affluence.leadTimes.buckets.reduce((sum, b) => sum + b.count, 0);

	const tabs = [
		{
			key: "overview",
			label: "Vue d’ensemble",
			content: (
				<div className="grid items-stretch gap-4 lg:grid-cols-3">
					<ChartPanel
						title="Activité"
						description={plural(t.appointments, "rendez-vous", "rendez-vous")}
						className="lg:col-span-2"
						chart={
							<SeriesChart
								series={series}
								bucket={period.bucket}
								keys={["completed", "pending", "noShow", "cancelled"]}
								totals={t}
							/>
						}
						table={
							<SeriesTable
								series={series}
								bucket={period.bucket}
								keys={["completed", "pending", "noShow", "cancelled"]}
								label={bucketName}
							/>
						}
					/>
					<Panel title="Points clés">
						<dl className="divide-y text-sm">
							{(
								[
									["Taux d’annulation", formatRate(t.cancellationRate)],
									busiest && ["Heure de pointe", `${WEEKDAYS[busiest.weekday - 1]}. ${busiest.hour} h`],
									median !== null && [
										"Délai de réservation",
										median === 0 ? "Le jour même" : plural(median, "jour", "jours"),
									],
									revenue && ["Reste dû", mad(revenue.outstanding.amount)],
								].filter(Boolean) as [string, string][]
							).map(([label, value]) => (
								<div key={label} className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
									<dt className="text-muted-foreground">{label}</dt>
									<dd className="font-medium whitespace-nowrap tabular-nums">{value}</dd>
								</div>
							))}
						</dl>
					</Panel>
				</div>
			),
		},
		...(revenue
			? [
					{
						key: "revenue",
						label: "Encaissements",
						content: (
							<>
								<ChartPanel
									title="Encaissé"
									description={
										[
											revenue.totals.refunded > 0 && `${mad(revenue.totals.refunded)} remboursés`,
											revenue.outstanding.amount > 0 && `${mad(revenue.outstanding.amount)} restent dus`,
										]
											.filter(Boolean)
											.join(" · ") || undefined
									}
									chart={<RevenueChart series={revenue.series} bucket={period.bucket} />}
									table={<RevenueTable series={revenue.series} bucket={period.bucket} />}
								/>
								<div className={cn("grid items-start gap-4", revenue.byAct.length > 0 && "lg:grid-cols-2")}>
									<Panel title="Par mode de paiement">
										<Bars
											rows={revenue.byMethod.map((m) => ({ key: m.method, label: METHOD_LABELS[m.method], value: m.net }))}
											format={mad}
											total={revenue.totals.net}
											empty="Aucun paiement sur la période."
										/>
									</Panel>
									{revenue.byAct.length > 0 && (
										<Panel title="Par acte">
											<Bars
												rows={revenue.byAct.map((a) => ({ key: a.label, label: a.label, detail: `× ${a.count}`, value: a.amount }))}
												format={mad}
											/>
										</Panel>
									)}
								</div>
							</>
						),
					},
				]
			: []),
		{
			key: "patients",
			label: "Patients",
			content: (
				<>
					<ChartPanel
						title="Patients vus"
						chart={
							<SeriesChart
								series={series}
								bucket={period.bucket}
								keys={["newPatients", "returningPatients"]}
								totals={{ newPatients: t.newPatients, returningPatients: t.patients - t.newPatients }}
							/>
						}
						table={
							<SeriesTable
								series={series}
								bucket={period.bucket}
								keys={["newPatients", "returningPatients"]}
								label={bucketName}
							/>
						}
					/>
					<div className="grid items-start gap-4 lg:grid-cols-3">
						<Panel title="Sexe">
							<Bars
								rows={[
									{ key: "female", label: "Femmes", value: patients.sex.female },
									{ key: "male", label: "Hommes", value: patients.sex.male },
								]}
								total={seenTotal}
							/>
						</Panel>
						<Panel title="Âge">
							<Bars
								rows={patients.age
									.filter((g) => g.key !== "unknown" || g.count > 0)
									.map((g) => ({ key: g.key, label: g.label, value: g.count }))}
								total={seenTotal}
							/>
						</Panel>
						<Panel title="Couverture">
							<Bars
								rows={patients.coverage.map((c) => ({
									key: c.key,
									label: COVERAGE_LABELS[c.key as Coverage] ?? c.key,
									value: c.count,
								}))}
								total={seenTotal}
							/>
						</Panel>
					</div>
				</>
			),
		},
		{
			key: "affluence",
			label: "Affluence",
			content: (
				<div className="grid items-start gap-4 xl:grid-cols-3">
					<Panel title="Par jour et par heure" description="Rendez-vous sur la période" className="xl:col-span-2">
						<AffluenceHeatmap cells={affluence.heatmap} />
					</Panel>
					<Panel
						title="Délai de réservation"
						description={
							median !== null &&
							(median === 0
								? "La moitié des rendez-vous sont pris le jour même"
								: `La moitié des rendez-vous sont pris ${plural(median, "jour", "jours")} à l’avance ou moins`)
						}
					>
						<Bars
							rows={affluence.leadTimes.buckets.map((b) => ({ key: b.key, label: b.label, value: b.count }))}
							total={leadTotal}
						/>
					</Panel>
				</div>
			),
		},
		...(report.byPractitioner || report.bySpace
			? [
					{
						key: "team",
						label: report.byPractitioner && report.bySpace ? "Médecins et espaces" : report.byPractitioner ? "Médecins" : "Espaces",
						content: (
							<div className={cn("grid items-start gap-4", (report.bySpace || revenue) && "lg:grid-cols-2")}>
								{report.byPractitioner && (
									<Panel title="Consultations par médecin">
										<Bars
											rows={report.byPractitioner.map((p) => ({
												key: p.id,
												label: p.name,
												detail: `${plural(p.patients, "patient", "patients")} · ${formatRate(p.noShowRate)} d’absences`,
												value: p.completed,
											}))}
										/>
									</Panel>
								)}
								{revenue && revenue.byPractitioner.length > 1 && (
									<Panel title="Encaissé par médecin">
										<Bars
											rows={revenue.byPractitioner.map((p) => ({ key: p.id, label: p.name, value: p.net }))}
											format={mad}
											total={revenue.totals.net}
										/>
									</Panel>
								)}
								{report.bySpace && (
									<Panel title="Consultations par espace">
										<Bars
											rows={report.bySpace.map((s) => ({
												key: s.id,
												label: spaceLabel(s),
												detail: `${plural(s.newPatients, "nouveau patient", "nouveaux patients")} · ${formatRate(s.noShowRate)} d’absences`,
												value: s.completed,
											}))}
										/>
									</Panel>
								)}
							</div>
						),
					},
				]
			: []),
	];

	return (
		<div className="grid min-w-0 grid-cols-1 gap-5">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Statistiques</h1>
				<p className="text-muted-foreground text-sm">
					{periodLabel(period.from, period.to)} · comparé aux {period.days} jours précédents
					{space && ` · ${spaceLabel(space)}`}
				</p>
			</header>

			<ReportsShell filters={<ReportsFilters preset={preset} report={report} userId={user.id} />}>
				<div className="flex flex-wrap gap-3">
					{revenue && (
						<StatCard
							label="Encaissé"
							value={mad(revenue.totals.net)}
							change={revenue.change}
							hint="Paiements reçus sur la période, remboursements déduits."
							trend={revenue.series.map((d) => d.net)}
						/>
					)}
					<StatCard
						label="Consultations"
						value={t.completed}
						change={activity.change.completed}
						hint="Rendez-vous marqués « vu » sur la période."
						trend={series.map((d) => d.completed)}
					/>
					<StatCard
						label="Patients vus"
						value={t.patients}
						change={activity.change.patients}
						hint="Patients différents vus au moins une fois sur la période."
						trend={series.map((d) => d.newPatients + d.returningPatients)}
					/>
					<StatCard
						label="Nouveaux patients"
						value={t.newPatients}
						change={activity.change.newPatients}
						hint="Patients dont la toute première consultation au cabinet a eu lieu sur la période."
						trend={series.map((d) => d.newPatients)}
					/>
					<StatCard
						label="Taux d’absence"
						value={formatRate(t.noShowRate)}
						change={points(t.noShowRate, activity.previous.noShowRate)}
						unit="pts"
						invert
						hint="Patients absents parmi les rendez-vous passés (vus + absents)."
						trend={series.map((d) => (d.completed + d.noShow ? (d.noShow / (d.completed + d.noShow)) * 100 : 0))}
					/>
				</div>

				{empty ? (
					<div className="bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
						<HiChartBar className="text-muted-foreground size-6" />
						<p className="font-medium">Aucun rendez-vous sur cette période</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							Les statistiques se remplissent avec l’agenda : choisissez une autre période ou un autre espace.
						</p>
					</div>
				) : (
					<ReportsTabs tabs={tabs} />
				)}
			</ReportsShell>
		</div>
	);
}
