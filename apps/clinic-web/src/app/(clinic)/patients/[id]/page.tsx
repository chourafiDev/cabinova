import { redirect } from "next/navigation";
import { patientHref } from "@/lib/patients";

/** Old address of a patient's file: it now opens in the sheet over the list. */
export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
	redirect(patientHref((await params).id));
}
