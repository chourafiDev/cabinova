import type { Metadata } from "next";
import { LuCalendarCheck, LuCircleDollarSign, LuStethoscope, LuUsers } from "react-icons/lu";
import Header from "./_components/header";
import { KpiCard } from "./_components/shared/kpi-card";

export const metadata: Metadata = { title: "Tableau de bord" };

// TODO(dashboard): replace the zeros with GET /dashboard/stats.
export default function DashboardPage() {
	const period = "Aujourd'hui";

	return (
		<>
			<Header />
			<section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={LuCalendarCheck}
					title="Rendez-vous"
					value={0}
					period={period}
					hint="Rendez-vous planifiés sur la période, tous statuts confondus."
					actions={[{ label: "Voir l'agenda", href: "/appointments" }]}
				/>
				<KpiCard
					icon={LuStethoscope}
					title="Consultations"
					value={0}
					period={period}
					hint="Consultations clôturées sur la période."
					actions={[{ label: "Voir les consultations", href: "/consultations" }]}
				/>
				<KpiCard
					icon={LuUsers}
					title="Patients"
					value={0}
					period={period}
					hint="Nouveaux patients enregistrés sur la période."
					actions={[{ label: "Voir les patients", href: "/patients" }]}
				/>
				<KpiCard
					icon={LuCircleDollarSign}
					title="Encaissements"
					value={0}
					suffix="MAD"
					period={period}
					hint="Total encaissé en caisse sur la période."
					actions={[{ label: "Voir la facturation", href: "/billing" }]}
				/>
			</section>
		</>
	);
}
