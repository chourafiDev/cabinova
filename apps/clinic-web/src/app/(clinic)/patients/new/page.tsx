import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPTY_PATIENT } from "@/lib/patients";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { PatientForm } from "../_components/patient-form";

export const metadata: Metadata = { title: "Nouveau patient" };

export default async function NewPatientPage() {
	const state = await getClinicState();
	const space = state.status === "signed-in" ? state.session.spaces?.current : undefined;
	return (
		<div className="grid gap-4">
			<header className="flex items-center gap-3">
				<Button asChild variant="ghost" size="icon" aria-label="Retour aux patients">
					<Link href="/patients">
						<ArrowLeft />
					</Link>
				</Button>
				<div>
					<h1 className="text-lg font-semibold leading-tight">Nouveau patient</h1>
					<p className="text-muted-foreground text-sm">
						{space ? `Dans l’espace ${spaceLabel(space)} · ` : ""}Le n° de dossier est attribué à l’enregistrement.
					</p>
				</div>
			</header>
			<PatientForm defaultValues={EMPTY_PATIENT} />
		</div>
	);
}
