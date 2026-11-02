import Link from "next/link";
import { LuBanknote, LuCalendarCheck, LuStethoscope, LuUserPlus } from "react-icons/lu";
import { pageTitle } from "@/i18n/titles";
import type { DashboardData } from "@/lib/dashboard";
import { getFormat } from "@/lib/get-format";
import { getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
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
 * The day at a glance, from the agenda and the patients of the current
 * space — or, for the owner, of every space (?espaces=tous).
 */
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
	const state = await getClinicState();
	if (state.status !== "signed-in") return null; // the layout already handled it
	const { session } = state;
	const isOwner = session.user.role === "owner";
	const manySpaces = (session.spaces?.spaces.length ?? 0) > 1;
	const all = isOwner && manySpaces && (await searchParams).espaces === "tous";
	const [data, checklist] = await Promise.all([
		apiGet<DashboardData>(all ? "/dashboard?scope=all" : "/dashboard"),
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

			{isOwner && manySpaces && current && (
				<nav className="bg-muted mb-3 flex w-fit rounded-lg p-0.5 text-sm" aria-label={t("scope")}>
					{[
						{ href: "/", label: spaceLabel(current), active: !all },
						{ href: "/?espaces=tous", label: t("allSpaces"), active: all },
					].map((tab) => (
						<Link
							key={tab.href}
							href={tab.href}
							aria-current={tab.active ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 transition-colors",
								tab.active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{tab.label}
						</Link>
					))}
				</nav>
			)}

			<section data-tour="kpis" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={LuCalendarCheck}
					title={t("kpi.appointments")}
					value={kpis.appointmentsToday}
					period={t("kpi.upcoming", { count: kpis.upcomingToday })}
					hint={t("kpi.appointmentsHint")}
					actions={[{ label: t("kpi.openAgenda"), href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={LuStethoscope}
					title={t("kpi.seen")}
					value={kpis.seenToday}
					change={kpis.seenChange}
					period={t("kpi.sameDay")}
					hint={t("kpi.seenHint")}
					actions={[{ label: t("kpi.openAgenda"), href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={LuUserPlus}
					title={t("kpi.newPatients")}
					value={kpis.newPatientsMonth}
					change={kpis.newPatientsChange}
					period={t("kpi.thisMonth")}
					hint={t("kpi.newPatientsHint")}
					actions={[{ label: t("kpi.seePatients"), href: "/patients" }]}
				/>
				{data.cashier.received !== null ? (
					<KpiCard
						icon={LuBanknote}
						title={t("kpi.received")}
						value={format.mad(data.cashier.received)}
						change={data.cashier.receivedChange}
						period={t("kpi.sameDay")}
						hint={t("kpi.receivedHint")}
						actions={[{ label: t("kpi.openPayments"), href: "/payments" }]}
					/>
				) : (
					<KpiCard
						icon={LuBanknote}
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
					<WeekActivityChart week={data.week} />
				</div>
				<div data-tour="subscription" className="h-full">
					<SubscriptionCard subscription={session.subscription} canManage={session.user.role === "owner"} />
				</div>
			</section>
		</>
	);
}
