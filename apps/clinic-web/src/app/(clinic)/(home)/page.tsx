import { IconCalendarCheck, IconMoney, IconStethoscope, IconUserAdd } from "@/components/icons";
import { pageTitle } from "@/i18n/titles";
import { type DashboardData, dashboardPeriod } from "@/lib/dashboard";
import { getFormat } from "@/lib/get-format";
import { getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { DashboardFilters } from "../_components/dashboard/dashboard-filters";
import { GettingStarted, type ChecklistSteps } from "../_components/dashboard/getting-started";
import { SpacesOverview } from "../_components/dashboard/spaces-overview";
import { SubscriptionCard } from "../_components/dashboard/subscription-card";
import { TodayAppointments } from "../_components/dashboard/today-appointments";
import { WaitingRoom } from "../_components/dashboard/waiting-room";
import { WeekActivityChart } from "../_components/dashboard/week-activity-chart";
import { WelcomeBanner } from "../_components/dashboard/welcome-banner";
import { KpiCard } from "../_components/kpi-card";

export const generateMetadata = () => pageTitle("dashboard");

/**
 * Figures and activity over a period (?periode=7j|30j|90j|1a, or ?du=&au=;
 * 7 days by default) plus today's appointments and waiting room, for the
 * current space — or, for the owner, every space (?espaces=tous).
 */
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
	const state = await getClinicState();
	if (state.status !== "signed-in") return null; // the layout already handled it
	const { session } = state;
	const isOwner = session.user.role === "owner";
	const manySpaces = (session.spaces?.spaces.length ?? 0) > 1;
	const params = await searchParams;
	const all = isOwner && manySpaces && params.espaces === "tous";
	const { preset, from, to } = dashboardPeriod(params);
	const query = new URLSearchParams({ from, to });
	if (all) query.set("scope", "all");
	const [data, checklist] = await Promise.all([
		apiGet<DashboardData>(`/dashboard?${query}`),
		isOwner ? apiGet<{ steps: ChecklistSteps | null }>("/onboarding/checklist") : null,
	]);
	const { kpis } = data;
	const current = session.spaces?.current;
	const t = await getTranslations("dashboard");
	const format = await getFormat();

	return (
		<>
			<WelcomeBanner session={session} date={data.date} upcoming={kpis.upcomingToday} />

			{checklist?.steps && <GettingStarted steps={checklist.steps} />}

			<DashboardFilters
				preset={preset}
				period={{ from, to }}
				space={isOwner && manySpaces && current ? { label: spaceLabel(current), all } : undefined}
			/>

			<section data-tour="kpis" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={IconCalendarCheck}
					title={t("kpi.appointments")}
					value={kpis.appointments}
					period={t("kpi.upcoming", { count: kpis.pending })}
					hint={t("kpi.appointmentsHint")}
					actions={[{ label: t("kpi.openAgenda"), href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={IconStethoscope}
					title={t("kpi.seen")}
					value={kpis.seen}
					change={kpis.seenChange}
					period={t("kpi.previous")}
					hint={t("kpi.seenHint")}
					actions={[{ label: t("kpi.openAgenda"), href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={IconUserAdd}
					title={t("kpi.newPatients")}
					value={kpis.newPatients}
					change={kpis.newPatientsChange}
					period={t("kpi.previous")}
					hint={t("kpi.newPatientsHint")}
					actions={[{ label: t("kpi.seePatients"), href: "/patients" }]}
				/>
				{data.cashier.received !== null ? (
					<KpiCard
						icon={IconMoney}
						title={t("kpi.received")}
						value={format.mad(data.cashier.received)}
						change={data.cashier.receivedChange}
						period={t("kpi.previous")}
						hint={t("kpi.receivedHint")}
						actions={[{ label: t("kpi.openPayments"), href: "/payments" }]}
					/>
				) : (
					<KpiCard
						icon={IconMoney}
						title={t("kpi.toCollect")}
						value={data.cashier.toCollect}
						period={t("kpi.toCollectPeriod", { count: data.cashier.toCollect })}
						hint={t("kpi.toCollectHint")}
						actions={[{ label: t("kpi.openCashier"), href: "/payments" }]}
					/>
				)}
			</section>

			{data.scope === "space" && data.appointments ? (
				<section data-tour="appointments" className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
					<div className="xl:col-span-2">
						<TodayAppointments appointments={data.appointments} />
					</div>
					<WaitingRoom appointments={data.appointments} />
				</section>
			) : (
				data.bySpace && (
					<section className="mb-3">
						<SpacesOverview spaces={data.bySpace} />
					</section>
				)
			)}

			<section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<WeekActivityChart series={data.series} bucket={data.period.bucket} />
				</div>
				<div data-tour="subscription" className="h-full">
					<SubscriptionCard subscription={session.subscription} canManage={session.user.role === "owner"} />
				</div>
			</section>
		</>
	);
}
