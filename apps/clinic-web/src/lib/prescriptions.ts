import type { Sex } from "./patients";

// Types of the Prescriptions API (clinic-api/src/prescriptions), doctors only.

/** One line of an ordonnance. */
export type PrescriptionItem = {
	medication: string;
	posology: string | null;
	duration: string | null;
	/** Where the line was picked from: the AMMPS list or the doctor's own medicines. */
	ammpsId?: number | null;
	customMedicationId?: string | null;
};

/** An ordonnance; GET /prescriptions/visit/:id returns { prescription }, null until written. */
export type Prescription = {
	id: string;
	appointmentId: string;
	items: PrescriptionItem[];
	notes: string | null;
	/** The ordonnance reworded in the editor (sanitized HTML), printed as is; null = the lines. */
	body: string | null;
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
	body: string | null;
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

/**
 * The form keeps text: an empty line has an empty medication. A line picked
 * from the suggestions keeps where it came from until its text is edited.
 */
export type ItemDraft = {
	key: string;
	medication: string;
	posology: string;
	duration: string;
	ammpsId: number | null;
	customMedicationId: string | null;
	/** Renewed from an old ordonnance, and the medicine has since been withdrawn (not sent). */
	warning?: "withdrawn" | "removed" | "deleted";
};

let keys = 0;
export const newItem = (from?: Partial<PrescriptionItem>): ItemDraft => ({
	key: `item-${++keys}`,
	medication: from?.medication ?? "",
	posology: from?.posology ?? "",
	duration: from?.duration ?? "",
	ammpsId: from?.ammpsId ?? null,
	customMedicationId: from?.customMedicationId ?? null,
});

/** What is sent: lines without a medication are left out; the source only when there is one. */
export const toItems = (drafts: ItemDraft[]): PrescriptionItem[] =>
	drafts
		.filter((d) => d.medication.trim())
		.map((d) => ({
			medication: d.medication.trim(),
			posology: d.posology.trim() || null,
			duration: d.duration.trim() || null,
			...(d.ammpsId !== null && { ammpsId: d.ammpsId }),
			...(d.customMedicationId !== null && { customMedicationId: d.customMedicationId }),
		}));

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The ordonnance as editor HTML, from its lines and advice: one numbered
 * item per medication (name in bold, posology, duration), then the advice.
 * What the editor shows until the doctor rewords it.
 */
export function composePrescription(items: PrescriptionItem[], notes: string | null) {
	const lines = items.map((i) => {
		const parts = [`<p><strong>${escapeHtml(i.medication)}</strong></p>`];
		if (i.posology) parts.push(`<p>${escapeHtml(i.posology)}</p>`);
		if (i.duration) parts.push(`<p>Durée : ${escapeHtml(i.duration)}</p>`);
		return `<li>${parts.join("")}</li>`;
	});
	const advice = (notes ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `<p>${escapeHtml(line)}</p>`);
	return [
		lines.length ? `<ol>${lines.join("")}</ol>` : "",
		advice.length ? `<p><strong>Conseils</strong></p>${advice.join("")}` : "",
	].join("");
}
