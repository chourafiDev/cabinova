import type { Sex } from "./patients";

// Types of the Prescriptions API (clinic-api/src/prescriptions), doctors only.

/** One line of an ordonnance. */
export type PrescriptionItem = { medication: string; posology: string | null; duration: string | null };

/** An ordonnance; GET /prescriptions/visit/:id returns { prescription }, null until written. */
export type Prescription = {
	id: string;
	appointmentId: string;
	items: PrescriptionItem[];
	notes: string | null;
	updatedAt: string;
};

/** GET /prescriptions?patientId= — past ordonnances, newest first. */
export type PastPrescription = Prescription & { date: string; practitioner: string | null };

/** GET /prescriptions/medications — what this doctor prescribed before. */
export type KnownMedication = PrescriptionItem;

/** GET /prescriptions/visit/:id/print */
export type PrintedPrescription = {
	items: PrescriptionItem[];
	notes: string | null;
	date: string;
	practitioner: string;
	weightKg: number | null;
	patient: { firstName: string; lastName: string; sex: Sex; birthDate: string | null; fileNumber: number };
	space: { name: string; city: string | null; address: string | null; phone: string | null };
	cabinet: {
		name: string;
		legalName: string | null;
		specialty: string | null;
		address: string | null;
		city: string | null;
		phone: string | null;
		email: string;
	};
};

/** The form keeps text: an empty line has an empty medication. */
export type ItemDraft = { key: string; medication: string; posology: string; duration: string };

let keys = 0;
export const newItem = (from?: Partial<PrescriptionItem>): ItemDraft => ({
	key: `item-${++keys}`,
	medication: from?.medication ?? "",
	posology: from?.posology ?? "",
	duration: from?.duration ?? "",
});

/** What is sent: lines without a medication are left out. */
export const toItems = (drafts: ItemDraft[]): PrescriptionItem[] =>
	drafts
		.filter((d) => d.medication.trim())
		.map((d) => ({
			medication: d.medication.trim(),
			posology: d.posology.trim() || null,
			duration: d.duration.trim() || null,
		}));
