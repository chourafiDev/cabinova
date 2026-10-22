import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmt } from "@/calendar/locale";
import { MedicalProfileCard } from "@/components/medical-profile-card";
import { Button } from "@/components/ui/button";
import { type Consultation, type ConsultationsPage, toConsultationInput } from "@/lib/consultations";
import { can } from "@/lib/permissions";
import { ageOf, formatFileNumber, fullName, SEX_LABELS } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { ConsultationStatusBadge } from "../_components/consultation-status-badge";
import { ConsultationEditor } from "./_components/consultation-editor";
import { PreviousConsultations } from "./_components/previous-consultations";

export const metadata = { title: "Consultation" };

export default async function ConsultationPage({ params }: PageProps<"/consultations/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "emr:read")) notFound();
	const consultation = await apiGet<Consultation>(`/consultations/${id}`);
	const { patient } = consultation;
	const previous = await apiGet<ConsultationsPage>(`/consultations?patientId=${patient.id}&perPage=6`);
	const canWrite = can(session.user.permissions, "emr:write");
	const age = ageOf(patient.birthDate);
	const locked = consultation.status === "completed";

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux consultations">
					<Link href="/consultations">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="grid min-w-0 leading-tight">
					<h1 className="flex items-center gap-2 truncate font-semibold">
						<Link href={`/patients/${patient.id}`} className="hover:underline">
							{fullName(patient)}
						</Link>
						<ConsultationStatusBadge status={consultation.status} />
					</h1>
					<span className="text-muted-foreground text-xs tabular-nums">
						{formatFileNumber(patient.fileNumber)} · {SEX_LABELS[patient.sex]}
						{age !== null && ` · ${age} ans`} · {consultation.practitioner.name} ·{" "}
						{fmt(new Date(consultation.startedAt), "d MMM yyyy, HH:mm")}
					</span>
				</div>
			</div>

			{locked && (
				<p className="bg-muted text-muted-foreground mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
					<Lock className="size-4 shrink-0" />
					Consultation clôturée le {fmt(new Date(consultation.completedAt!), "d MMMM yyyy à HH:mm")} : lecture seule.
				</p>
			)}

			<div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
				<ConsultationEditor
					key={consultation.updatedAt}
					consultationId={consultation.id}
					defaultValues={toConsultationInput(consultation)}
					readOnly={locked || !canWrite}
				/>
				<div className="grid gap-3">
					<MedicalProfileCard patientId={patient.id} profile={consultation.medicalProfile} canWrite={canWrite} />
					<PreviousConsultations items={previous.data.filter((c) => c.id !== consultation.id)} />
				</div>
			</div>
		</>
	);
}
