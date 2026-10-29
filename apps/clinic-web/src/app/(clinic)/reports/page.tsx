import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HiChartBar } from "react-icons/hi2";
import { LuCalendarCheck, LuTimer, LuUserPlus, LuUsers, LuUserX } from "react-icons/lu";
import { ChartCard } from "../_components/dashboard/chart-card";
import { KpiCard } from "../_components/kpi-card";
import { COVERAGE_LABELS, type Coverage } from "@/lib/patients";
import {
	DEFAULT_PRESET,
	formatRate,
	PRESETS,
	type PresetKey,
	type Report,
} from "@/lib/reports";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { AffluenceHeatmap } from "./_components/affluence-heatmap";
import { Bars, withShare } from "./_components/bars";
import { ReportsFilters } from "./_components/reports-filters";
import { ReportsShell } from "./_components/reports-shell";
import { SeriesChart } from "./_components/series-chart";
import { RevenueChart } from "./_components/revenue-chart";
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
	const vsPrevious = `vs ${period.days} j précédents`;
	const seenTotal = patients.sex.male + patients.sex.female;
	const empty = t.appointments + t.cancelled === 0;
	const bucketName = { day: "Jour", week: "Semaine", month: "Mois" }[period.bucket];

	return (
		<div className="grid gap-4">
			<header className="flex items-center gap-3">
				<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
					<HiChartBar className="size-4" />
				</span>
				<div>
					<h1 className="text-lg font-semibold leading-tight">Statistiques</h1>
					<p className="text-muted-foreground text-sm">
						Activité du cabinet d’après l’agenda
						{report.filters.space &&
							` · ${spaceLabel(report.filters.spaces.find((s) => s.id === report.filters.space)!)}`}
					</p>
				</div>
			</header>

			<ReportsShell filters={<ReportsFilters preset={preset} report={report} userId={user.id} />}>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<KpiCard
						icon={LuCalendarCheck}
						title="Consultations"
						value={t.completed}
						change={activity.change.completed}
						period={vsPrevious}
						hint="Rendez-vous marqués « vu » sur la période."
					/>
					<KpiCard
						icon={LuUsers}
						title="Patients vus"
						value={t.patients}
						change={activity.change.patients}
						period={vsPrevious}
						hint="Patients différents vus au moins une fois sur la période."
					/>
					<KpiCard
						icon={LuUserPlus}
						title="Nouveaux patients"
						value={t.newPatients}
						change={activity.change.newPatients}
						period={vsPrevious}
						hint="Patients dont la toute première consultation au cabinet a eu lieu sur la période."
					/>
					<KpiCard
						icon={LuUserX}
						title="Taux d’absence"
						value={formatRate(t.noShowRate)}
						change={points(t.noShowRate, activity.previous.noShowRate)}
						changeUnit="pts"
						invert
						period={vsPrevious}
						hint="Patients absents parmi les rendez-vous passés (vus + absents)."
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
					<>
						<ChartCard
							title="Activité"
							headline={
								<p className="text-muted-foreground text-xs">
									{plural(t.appointments, "rendez-vous", "rendez-vous")} · {formatRate(t.cancellationRate)}{" "}
									d’annulations ({t.cancelled}) · {t.pending} à venir
								</p>
							}
						>
							<SeriesChart
								series={activity.series}
								bucket={period.bucket}
								keys={["completed", "pending", "noShow", "cancelled"]}
								tableLabel={bucketName}
							/>
						</ChartCard>

						{report.revenue && (
							<div className="grid items-start gap-4 lg:grid-cols-3">
								<ChartCard
									title="Encaissements"
									className="lg:col-span-2"
									headline={
										<p className="flex flex-wrap items-baseline gap-x-3">
											<span className="text-2xl font-semibold">{mad(report.revenue.totals.net)}</span>
											<span className="text-muted-foreground text-xs">
												{report.revenue.change === null
													? "nouveau sur la période"
													: `${report.revenue.change > 0 ? "+" : ""}${report.revenue.change} % ${vsPrevious}`}
												{report.revenue.totals.refunded > 0 && ` · ${mad(report.revenue.totals.refunded)} remboursés`}
												{report.revenue.outstanding.amount > 0 &&
													` · ${mad(report.revenue.outstanding.amount)} restent dus`}
											</span>
										</p>
									}
								>
									<RevenueChart series={report.revenue.series} bucket={period.bucket} />
								</ChartCard>
								<ChartCard title="Répartition" eyebrow="Encaissements">
									<div className="grid gap-5">
										<Bars
											rows={report.revenue.byMethod.map((m) => ({ key: m.method, label: METHOD_LABELS[m.method], value: m.net }))}
											format={mad}
											empty="Aucun paiement sur la période."
										/>
										{report.revenue.byAct.length > 0 && (
											<div className="grid gap-2">
												<h3 className="text-muted-foreground text-xs font-medium">Actes facturés</h3>
												<Bars
													rows={report.revenue.byAct.map((a) => ({
														key: a.label,
														label: (
															<>
																{a.label} <span className="text-muted-foreground">× {a.count}</span>
															</>
														),
														value: a.amount,
													}))}
													format={mad}
												/>
											</div>
										)}
										{report.revenue.byPractitioner.length > 1 && (
											<div className="grid gap-2">
												<h3 className="text-muted-foreground text-xs font-medium">Par médecin</h3>
												<Bars
													rows={report.revenue.byPractitioner.map((p) => ({ key: p.id, label: p.name, value: p.net }))}
													format={mad}
												/>
											</div>
										)}
									</div>
								</ChartCard>
							</div>
						)}

						<div className="grid items-start gap-4 lg:grid-cols-5">
							<ChartCard
								title="Patients vus"
								className="lg:col-span-3"
								headline={
									<p className="text-muted-foreground text-xs">
										{plural(t.newPatients, "nouveau", "nouveaux")} · {plural(t.patients - t.newPatients, "déjà suivi", "déjà suivis")}
									</p>
								}
							>
								<SeriesChart
									series={activity.series}
									bucket={period.bucket}
									keys={["newPatients", "returningPatients"]}
									tableLabel={bucketName}
								/>
							</ChartCard>
							<ChartCard title="Profil des patients vus" className="lg:col-span-2">
								<div className="grid gap-5">
									<Bars
										rows={[
											{ key: "female", label: "Femmes", value: patients.sex.female },
											{ key: "male", label: "Hommes", value: patients.sex.male },
										]}
										format={withShare(seenTotal)}
									/>
									<div className="grid gap-2">
										<h3 className="text-muted-foreground text-xs font-medium">Âge</h3>
										<Bars
											rows={patients.age
												.filter((g) => g.key !== "unknown" || g.count > 0)
												.map((g) => ({ key: g.key, label: g.label, value: g.count }))}
											format={withShare(seenTotal)}
										/>
									</div>
									<div className="grid gap-2">
										<h3 className="text-muted-foreground text-xs font-medium">Couverture</h3>
										<Bars
											rows={patients.coverage.map((c) => ({
												key: c.key,
												label: COVERAGE_LABELS[c.key as Coverage] ?? c.key,
												value: c.count,
											}))}
											format={withShare(seenTotal)}
										/>
									</div>
								</div>
							</ChartCard>
						</div>

						{(report.byPractitioner || report.bySpace) && (
							<div className={cn("grid gap-4", report.byPractitioner && report.bySpace && "lg:grid-cols-2")}>
								{report.byPractitioner && (
									<ChartCard title="Par médecin" headline={<p className="text-muted-foreground text-xs">Consultations</p>}>
										<Bars
											rows={report.byPractitioner.map((p) => ({
												key: p.id,
												label: (
													<>
														{p.name}
														<span className="text-muted-foreground">
															{" "}
															· {plural(p.patients, "patient", "patients")} · {formatRate(p.noShowRate)} d’absences
														</span>
													</>
												),
												value: p.completed,
											}))}
										/>
									</ChartCard>
								)}
								{report.bySpace && (
									<ChartCard title="Par espace" headline={<p className="text-muted-foreground text-xs">Consultations</p>}>
										<Bars
											rows={report.bySpace.map((s) => ({
												key: s.id,
												label: (
													<>
														{spaceLabel(s)}
														<span className="text-muted-foreground">
															{" "}
															· {plural(s.newPatients, "nouveau patient", "nouveaux patients")} ·{" "}
															{formatRate(s.noShowRate)} d’absences
														</span>
													</>
												),
												value: s.completed,
											}))}
										/>
									</ChartCard>
								)}
							</div>
						)}

						<div className="grid gap-4 xl:grid-cols-5">
							<ChartCard
								title="Affluence"
								className="xl:col-span-3"
								headline={<p className="text-muted-foreground text-xs">Rendez-vous par jour et par heure</p>}
							>
								<AffluenceHeatmap cells={report.affluence.heatmap} />
							</ChartCard>
							<ChartCard
								title="Délai de prise de rendez-vous"
								className="xl:col-span-2"
								headline={
									report.affluence.leadTimes.median !== null && (
										<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
											<LuTimer className="size-3.5" />
											{report.affluence.leadTimes.median === 0
												? "La moitié des rendez-vous sont pris le jour même"
												: `La moitié des rendez-vous sont pris ${plural(report.affluence.leadTimes.median, "jour", "jours")} à l’avance ou moins`}
										</p>
									)
								}
							>
								<Bars
									rows={report.affluence.leadTimes.buckets.map((b) => ({ key: b.key, label: b.label, value: b.count }))}
									format={withShare(report.affluence.leadTimes.buckets.reduce((s, b) => s + b.count, 0))}
								/>
							</ChartCard>
						</div>
					</>
				)}
			</ReportsShell>
		</div>
	);
}
