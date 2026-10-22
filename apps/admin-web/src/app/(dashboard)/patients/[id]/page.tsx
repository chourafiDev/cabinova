import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment } from "@/lib/appointments";
import type { ConsultationsPage, MedicalProfile } from "@/lib/consultations";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ageOf, formatFileNumber, fullName, type Patient, SEX_LABELS, toInput } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { PatientForm } from "../_components/patient-form";
import { ArchiveButton } from "./_components/archive-button";
import { PatientAppointments } from "./_components/patient-appointments";
import { PatientConsultations } from "./_components/patient-consultations";

export async function generateMetadata({ params }: PageProps<"/patients/[id]">) {
	const patient = await apiGet<Patient>(`/patients/${(await params).id}`);
	return { title: fullName(patient) };
}

export default async function PatientPage({ params, searchParams }: PageProps<"/patients/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "patients:read")) notFound();
	const permissions = session.user.permissions;
	const canSeeAppointments = can(permissions, "appointments:read");
	const canSeeEmr = can(permissions, "emr:read");
	const requested = (await searchParams).tab;
	const tab =
		requested === "appointments" && canSeeAppointments
			? "appointments"
			: requested === "consultations" && canSeeEmr
				? "consultations"
				: "file";
	const [patient, appointments, consultations, profile] = await Promise.all([
		apiGet<Patient>(`/patients/${id}`),
		// Lists are fetched on every tab: the tabs show their counts.
		canSeeAppointments
			? apiGet<Appointment[]>(`/appointments?patientId=${id}&includeCancelled=true`)
			: Promise.resolve(null),
		canSeeEmr ? apiGet<ConsultationsPage>(`/consultations?patientId=${id}&perPage=100`) : Promise.resolve(null),
		// Antécédents only on their tab: each read is audited.
		tab === "consultations" ? apiGet<MedicalProfile>(`/patients/${id}/medical-profile`) : Promise.resolve(null),
	]);
	const canWrite = can(permissions, "patients:write");
	const age = ageOf(patient.birthDate);
	const archived = !!patient.archivedAt;

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux patients">
					<Link href="/patients">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg font-semibold">
					{patient.lastName.charAt(0).toUpperCase()}
					{patient.firstName.charAt(0).toUpperCase()}
				</div>
				<div className="grid min-w-0 leading-tight">
					<h1 className="flex items-center gap-2 truncate font-semibold">
						{fullName(patient)}
						{archived && (
							<Badge variant="outline" className="border-transparent bg-zinc-100 text-zinc-500">
								Archivé
							</Badge>
						)}
					</h1>
					<span className="text-muted-foreground text-xs tabular-nums">
						{formatFileNumber(patient.fileNumber)} · {SEX_LABELS[patient.sex]}
						{age !== null && ` · ${age} ans`} · Créé le {formatDate(patient.createdAt, { month: "short" })}
					</span>
				</div>
				{canWrite && (
					<div className="ms-auto">
						<ArchiveButton patientId={patient.id} name={fullName(patient)} archived={archived} />
					</div>
				)}
			</div>
			{(appointments || consultations) && (
				<Tabs value={tab} className="mb-3">
					<TabsList>
						<TabsTrigger value="file" asChild>
							<Link href={`/patients/${patient.id}`} replace scroll={false}>
								Dossier
							</Link>
						</TabsTrigger>
						{appointments && (
							<TabsTrigger value="appointments" asChild>
								<Link href={`/patients/${patient.id}?tab=appointments`} replace scroll={false}>
									Rendez-vous
									<span className="text-muted-foreground tabular-nums">{appointments.length}</span>
								</Link>
							</TabsTrigger>
						)}
						{consultations && (
							<TabsTrigger value="consultations" asChild>
								<Link href={`/patients/${patient.id}?tab=consultations`} replace scroll={false}>
									Consultations
									<span className="text-muted-foreground tabular-nums">{consultations.total}</span>
								</Link>
							</TabsTrigger>
						)}
					</TabsList>
				</Tabs>
			)}
			{tab === "consultations" && consultations && profile ? (
				<PatientConsultations
					patientId={patient.id}
					consultations={consultations.data}
					profile={profile}
					canWrite={can(permissions, "emr:write")}
					canStart={can(permissions, "emr:write") && !archived}
				/>
			) : tab === "appointments" && appointments ? (
				<PatientAppointments
					appointments={appointments}
					bookHref={
						can(permissions, "appointments:write") && !archived
							? `/appointments?book=${patient.id}`
							: undefined
					}
				/>
			) : (
				<PatientForm
					key={patient.updatedAt}
					patientId={patient.id}
					defaultValues={toInput(patient)}
					readOnly={!canWrite || archived}
				/>
			)}
		</>
	);
}
