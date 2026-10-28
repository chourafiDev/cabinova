import type { Metadata } from "next";
import Link from "next/link";
import { LuBanknote, LuCalendarCheck, LuStethoscope, LuUserPlus } from "react-icons/lu";
import type { DashboardData } from "@/lib/dashboard";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { SpacesOverview } from "./_components/dashboard/spaces-overview";
import { SubscriptionCard } from "./_components/dashboard/subscription-card";
import { TodayAppointments } from "./_components/dashboard/today-appointments";
import { WaitingRoom } from "./_components/dashboard/waiting-room";
import { WeekActivityChart } from "./_components/dashboard/week-activity-chart";
import { WelcomeBanner } from "./_components/dashboard/welcome-banner";
import { KpiCard } from "./_components/kpi-card";

export const metadata: Metadata = { title: "Tableau de bord" };

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
	const data = await apiGet<DashboardData>(all ? "/dashboard?scope=all" : "/dashboard");
	const { kpis } = data;
	const current = session.spaces?.current;

	return (
		<>
			<WelcomeBanner session={session} date={data.date} upcoming={kpis.upcomingToday} />

			{isOwner && manySpaces && current && (
				<nav className="bg-muted mb-3 flex w-fit rounded-lg p-0.5 text-sm" aria-label="Périmètre">
					{[
						{ href: "/", label: spaceLabel(current), active: !all },
						{ href: "/?espaces=tous", label: "Tous les espaces", active: all },
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
					title="Rendez-vous"
					value={kpis.appointmentsToday}
					period={`${kpis.upcomingToday} à venir`}
					hint="Rendez-vous prévus aujourd’hui, hors annulations."
					actions={[{ label: "Ouvrir l’agenda", href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={LuStethoscope}
					title="Patients vus"
					value={kpis.seenToday}
					change={kpis.seenChange}
					period="vs même jour, semaine dernière"
					hint="Rendez-vous terminés aujourd’hui."
					actions={[{ label: "Ouvrir l’agenda", href: "/appointments?view=day" }]}
				/>
				<KpiCard
					icon={LuUserPlus}
					title="Nouveaux patients"
					value={kpis.newPatientsMonth}
					change={kpis.newPatientsChange}
					period="Ce mois-ci"
					hint="Dossiers créés ce mois-ci, comparés au mois dernier."
					actions={[{ label: "Voir les patients", href: "/patients" }]}
				/>
				<KpiCard
					icon={LuBanknote}
					title="Encaissements"
					value="—"
					period="Module à venir"
					hint="Les encaissements apparaîtront ici avec le module de facturation du cabinet."
				/>
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
					<SubscriptionCard subscription={session.subscription} />
				</div>
			</section>
		</>
	);
}
