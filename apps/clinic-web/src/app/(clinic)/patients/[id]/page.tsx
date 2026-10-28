import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, initials } from "@/lib/format";
import {
	ageOf,
	formatFileNumber,
	fullName,
	isMedicalRole,
	type PatientFile,
	SEX_LABELS,
	toInput,
} from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { PatientForm } from "../_components/patient-form";
import { ArchiveButton } from "./_components/archive-button";
import { MedicalProfileCard } from "./_components/medical-profile-card";

export async function generateMetadata({ params }: PageProps<"/patients/[id]">): Promise<Metadata> {
	const patient = await apiGet<PatientFile>(`/patients/${(await params).id}`);
	return { title: fullName(patient) };
}

/** A patient's file: identity and contact (editable), antécédents for doctors, archiving. */
export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
	const { id } = await params;
	const [patient, state] = await Promise.all([apiGet<PatientFile>(`/patients/${id}`), getClinicState()]);
	const medical = state.status === "signed-in" && isMedicalRole(state.session.user.role);
	const archived = patient.archivedAt !== null;
	const age = ageOf(patient.birthDate);
	const name = fullName(patient);

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<Button asChild variant="ghost" size="icon" aria-label="Retour aux patients">
						<Link href="/patients">
							<ArrowLeft />
						</Link>
					</Button>
					<span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold">
						{initials(`${patient.firstName} ${patient.lastName}`)}
					</span>
					<div className="min-w-0">
						<h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
							<span className="truncate">{name}</span>
							{archived && <Badge variant="secondary">Archivé</Badge>}
						</h1>
						<p className="text-muted-foreground text-sm">
							{[
								formatFileNumber(patient.fileNumber),
								SEX_LABELS[patient.sex],
								age !== null && `${age} ans`,
								`créé le ${formatDate(patient.createdAt, { month: "short" })}`,
							]
								.filter(Boolean)
								.join(" · ")}
						</p>
					</div>
				</div>
				<ArchiveButton patientId={patient.id} archived={archived} name={name} />
			</header>

			{archived && (
				<p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
					Dossier archivé le {formatDate(patient.archivedAt!)} : lecture seule. Restaurez-le pour le modifier.
				</p>
			)}

			<div className="grid gap-3 xl:grid-cols-[1fr_340px] xl:items-start">
				<PatientForm patientId={patient.id} defaultValues={toInput(patient)} readOnly={archived} />
				{medical && (
					<MedicalProfileCard patientId={patient.id} profile={patient.medicalProfile ?? null} readOnly={archived} />
				)}
			</div>
		</div>
	);
}
