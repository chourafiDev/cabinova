import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { EMPTY_PATIENT } from "@/lib/patients";
import { getSession } from "@/lib/session";
import { PatientForm } from "../_components/patient-form";

export const metadata = { title: "Nouveau patient" };

export default async function NewPatientPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "patients:write")) notFound();

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux patients">
					<Link href="/patients">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Nouveau patient</h1>
			</div>
			<PatientForm defaultValues={EMPTY_PATIENT} />
		</>
	);
}
