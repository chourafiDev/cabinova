// Lettres and comptes rendus (clinic-api /letters): what the doctor writes about the patient.
import type { Sex } from "./patients";
import type { PrintedPrescription } from "./prescriptions";

/** A letter (to a colleague, a hospital…) or a compte rendu of the consultation. */
export type LetterKind = "letter" | "report";

/** GET /letters?patientId=&kind= — newest first. */
export type Letter = {
	id: string;
	kind: LetterKind;
	/** Sanitized HTML, as printed. */
	body: string;
	appointmentId: string | null;
	createdAt: string;
	updatedAt: string;
	practitionerId: string | null;
	practitioner: string | null;
};

/** GET /letters/:id/print. */
export type PrintedLetter = Letter & {
	patient: { firstName: string; lastName: string; sex: Sex; birthDate: string | null; cin: string | null; fileNumber: number };
	space: PrintedPrescription["space"];
	cabinet: PrintedPrescription["cabinet"];
};

export const lettersKey = (patientId: string, kind: LetterKind) => ["letters", patientId, kind];
