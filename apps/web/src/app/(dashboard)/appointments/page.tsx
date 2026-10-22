import { notFound } from "next/navigation";
import type { Practitioner } from "@/lib/appointments";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { Agenda } from "./_components/agenda";

export const metadata = { title: "Agenda" };

export default async function AppointmentsPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "appointments:read")) notFound();
	const practitioners = await apiGet<Practitioner[]>("/appointments/practitioners");

	return <Agenda practitioners={practitioners} canWrite={can(session.user.permissions, "appointments:write")} />;
}
