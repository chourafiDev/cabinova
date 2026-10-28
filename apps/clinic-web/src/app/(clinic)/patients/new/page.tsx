import { redirect } from "next/navigation";
import { NEW_PATIENT_HREF } from "@/lib/patients";

/** Old address of the new-patient form: it now opens in the sheet over the list. */
export default function NewPatientPage() {
	redirect(NEW_PATIENT_HREF);
}
