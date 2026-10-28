import type { Metadata } from "next";
import { LuBanknote, LuCalendarCheck, LuStethoscope, LuUserPlus } from "react-icons/lu";
import { formatMad } from "@/lib/format";
import { getDashboard } from "@/lib/sample-data";
import { getClinicState } from "@/lib/session";
import { SubscriptionCard } from "./_components/dashboard/subscription-card";
import { TodayAppointments } from "./_components/dashboard/today-appointments";
import { WaitingRoom } from "./_components/dashboard/waiting-room";
import { WeekActivityChart } from "./_components/dashboard/week-activity-chart";
import { WelcomeBanner } from "./_components/dashboard/welcome-banner";
import { KpiCard } from "./_components/kpi-card";

export const metadata: Metadata = { title: "Tableau de bord" };

/**
 * The cabinet's day at a glance: today's appointments, the waiting room,
 * the week's activity and the offer's limits. The cabinet, the user and the
 * offer are real; the activity is sample data until the agenda exists.
 */
export default async function DashboardPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in") return null; // the layout already handled it
	const { session } = state;
	const { date, kpis, appointments, week } = getDashboard(new Date());

	return (
		<>
			<WelcomeBanner session={session} date={date} upcoming={kpis.upcomingToday} />

			<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={LuCalendarCheck}
					title="Rendez-vous"
					value={kpis.appointmentsToday}
					period={`${kpis.upcomingToday} à venir`}
					hint="Rendez-vous prévus aujourd’hui, hors annulations."
					actions={[{ label: "Ouvrir l’agenda", href: "/appointments" }]}
				/>
				<KpiCard
					icon={LuStethoscope}
					title="Patients vus"
					value={kpis.seenToday}
					change={kpis.seenChange}
					period="vs même jour, semaine dernière"
					hint="Consultations terminées aujourd’hui."
					actions={[{ label: "Voir les consultations", href: "/consultations" }]}
				/>
				<KpiCard
					icon={LuUserPlus}
					title="Nouveaux patients"
					value={kpis.newPatientsMonth}
					change={kpis.newPatientsChange}
					period="Ce mois-ci"
					hint="Patients enregistrés pour la première fois ce mois-ci, comparés au mois dernier."
					actions={[{ label: "Voir les patients", href: "/patients" }]}
				/>
				<KpiCard
					icon={LuBanknote}
					title="Encaissements"
					value={formatMad(kpis.collectedToday).replace(" MAD", "")}
					suffix="MAD"
					change={kpis.collectedChange}
					period="Aujourd’hui"
					hint="Total encaissé aujourd’hui, comparé au même jour la semaine dernière."
					actions={[{ label: "Voir les encaissements", href: "/payments" }]}
				/>
			</section>

			<section className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<TodayAppointments appointments={appointments} />
				</div>
				<WaitingRoom appointments={appointments} />
			</section>

			<section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<WeekActivityChart week={week} />
				</div>
				<SubscriptionCard subscription={session.subscription} />
			</section>
		</>
	);
}
