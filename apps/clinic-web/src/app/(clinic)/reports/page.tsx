import { moroccoDay } from "@cabinova/morocco-time";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HiChartBar } from "react-icons/hi2";
import { pageTitle } from "@/i18n/titles";
import { COVERAGE_LABELS, type Coverage } from "@/lib/patients";
import { getFormat } from "@/lib/get-format";
import {
	DEFAULT_PRESET,
	PRESETS,
	type PresetKey,
	type Report,
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
import { cn } from "@/lib/utils";

export const generateMetadata = () => pageTitle("reports");

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const span = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
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
	const end = moroccoDay();
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
	const m = await getTranslations("reports");
	const common = await getTranslations("common");
	const methods = await getTranslations("payments.methods");
	const format = await getFormat();
	const { mad, rate: formatRate } = format;
	const weekdays = format.weekdays("short");
	const days = (count: number) => m("overview.days", { count });
	const seenTotal = patients.sex.male + patients.sex.female;
	const empty = t.appointments + t.cancelled === 0;
	const bucketName = m(`buckets.${period.bucket}`);
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
			label: m("tabs.overview"),
			content: (
				<div className="grid items-stretch gap-4 lg:grid-cols-3">
					<ChartPanel
						title={m("overview.activity")}
						description={m("overview.appointments", { count: t.appointments })}
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
					<Panel title={m("overview.keyPoints")}>
						<dl className="divide-y text-sm">
							{(
								[
									[m("overview.cancellationRate"), formatRate(t.cancellationRate)],
									busiest && [m("overview.peakHour"), m("overview.peakValue", { day: weekdays[busiest.weekday - 1], hour: busiest.hour })],
									median !== null && [
										m("overview.leadTime"),
										median === 0 ? m("overview.sameDay") : days(median),
									],
									revenue && [m("overview.outstanding"), mad(revenue.outstanding.amount)],
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
						label: m("tabs.revenue"),
						content: (
							<>
								<ChartPanel
									title={m("revenue.received")}
									description={
										[
											revenue.totals.refunded > 0 && m("revenue.refunded", { amount: mad(revenue.totals.refunded) }),
											revenue.outstanding.amount > 0 && m("revenue.outstanding", { amount: mad(revenue.outstanding.amount) }),
										]
											.filter(Boolean)
											.join(" · ") || undefined
									}
									chart={<RevenueChart series={revenue.series} bucket={period.bucket} />}
									table={<RevenueTable series={revenue.series} bucket={period.bucket} />}
								/>
								<div className={cn("grid items-start gap-4", revenue.byAct.length > 0 && "lg:grid-cols-2")}>
									<Panel title={m("revenue.byMethod")}>
										<Bars
											rows={revenue.byMethod.map((x) => ({ key: x.method, label: methods(x.method), value: x.net }))}
											format={mad}
											total={revenue.totals.net}
											empty={m("revenue.noPayments")}
										/>
									</Panel>
									{revenue.byAct.length > 0 && (
										<Panel title={m("revenue.byAct")}>
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
			label: m("tabs.patients"),
			content: (
				<>
					<ChartPanel
						title={m("patients.seen")}
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
						<Panel title={m("patients.sex")}>
							<Bars
								rows={[
									{ key: "female", label: m("patients.women"), value: patients.sex.female },
									{ key: "male", label: m("patients.men"), value: patients.sex.male },
								]}
								total={seenTotal}
							/>
						</Panel>
						<Panel title={m("patients.age")}>
							<Bars
								rows={patients.age
									.filter((g) => g.key !== "unknown" || g.count > 0)
									.map((g) => ({ key: g.key, label: m.has(`ages.${g.key}`) ? m(`ages.${g.key}`) : g.label, value: g.count }))}
								total={seenTotal}
							/>
						</Panel>
						<Panel title={m("patients.coverage")}>
							<Bars
								rows={patients.coverage.map((c) => ({
									key: c.key,
									label: c.key in COVERAGE_LABELS ? common(`coverage.${c.key as Coverage}`) : c.key,
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
			label: m("tabs.affluence"),
			content: (
				<div className="grid items-start gap-4 xl:grid-cols-3">
					<Panel title={m("affluence.byDayHour")} description={m("affluence.onPeriod")} className="xl:col-span-2">
						<AffluenceHeatmap cells={affluence.heatmap} />
					</Panel>
					<Panel
						title={m("affluence.leadTime")}
						description={
							median !== null &&
							(median === 0
								? m("affluence.sameDayHint")
								: m("affluence.daysHint", { days: days(median) }))
						}
					>
						<Bars
							rows={affluence.leadTimes.buckets.map((b) => ({ key: b.key, label: m.has(`leadTimes.${b.key}`) ? m(`leadTimes.${b.key}`) : b.label, value: b.count }))}
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
						label: m(report.byPractitioner && report.bySpace ? "tabs.doctorsSpaces" : report.byPractitioner ? "tabs.doctors" : "tabs.spaces"),
						content: (
							<div className={cn("grid items-start gap-4", (report.bySpace || revenue) && "lg:grid-cols-2")}>
								{report.byPractitioner && (
									<Panel title={m("team.consultationsByDoctor")}>
										<Bars
											rows={report.byPractitioner.map((p) => ({
												key: p.id,
												label: p.name,
												detail: `${m("team.patients", { count: p.patients })} · ${m("team.absences", { rate: formatRate(p.noShowRate) })}`,
												value: p.completed,
											}))}
										/>
									</Panel>
								)}
								{revenue && revenue.byPractitioner.length > 1 && (
									<Panel title={m("team.receivedByDoctor")}>
										<Bars
											rows={revenue.byPractitioner.map((p) => ({ key: p.id, label: p.name, value: p.net }))}
											format={mad}
											total={revenue.totals.net}
										/>
									</Panel>
								)}
								{report.bySpace && (
									<Panel title={m("team.consultationsBySpace")}>
										<Bars
											rows={report.bySpace.map((s) => ({
												key: s.id,
												label: spaceLabel(s),
												detail: `${m("team.newPatients", { count: s.newPatients })} · ${m("team.absences", { rate: formatRate(s.noShowRate) })}`,
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
				<h1 className="text-2xl font-semibold tracking-tight">{m("title")}</h1>
				<p className="text-muted-foreground text-sm">
					{format.period(period.from, period.to)} · {m("comparedTo", { days: period.days })}
					{space && ` · ${spaceLabel(space)}`}
				</p>
			</header>

			<ReportsShell filters={<ReportsFilters preset={preset} report={report} userId={user.id} />}>
				<div className="flex flex-wrap gap-3">
					{revenue && (
						<StatCard
							label={m("cards.received")}
							value={mad(revenue.totals.net)}
							change={revenue.change}
							hint={m("cards.receivedHint")}
							trend={revenue.series.map((d) => d.net)}
						/>
					)}
					<StatCard
						label={m("cards.consultations")}
						value={t.completed}
						change={activity.change.completed}
						hint={m("cards.consultationsHint")}
						trend={series.map((d) => d.completed)}
					/>
					<StatCard
						label={m("cards.seen")}
						value={t.patients}
						change={activity.change.patients}
						hint={m("cards.seenHint")}
						trend={series.map((d) => d.newPatients + d.returningPatients)}
					/>
					<StatCard
						label={m("cards.newPatients")}
						value={t.newPatients}
						change={activity.change.newPatients}
						hint={m("cards.newPatientsHint")}
						trend={series.map((d) => d.newPatients)}
					/>
					<StatCard
						label={m("cards.noShowRate")}
						value={formatRate(t.noShowRate)}
						change={points(t.noShowRate, activity.previous.noShowRate)}
						unit="pts"
						invert
						hint={m("cards.noShowHint")}
						trend={series.map((d) => (d.completed + d.noShow ? (d.noShow / (d.completed + d.noShow)) * 100 : 0))}
					/>
				</div>

				{empty ? (
					<div className="bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
						<HiChartBar className="text-muted-foreground size-6" />
						<p className="font-medium">{m("empty.title")}</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{m("empty.hint")}
						</p>
					</div>
				) : (
					<ReportsTabs tabs={tabs} />
				)}
			</ReportsShell>
		</div>
	);
}
