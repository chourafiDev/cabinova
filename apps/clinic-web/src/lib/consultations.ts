import type { Appointment } from "./appointments";

// Types and helpers of the Consultations API (clinic-api/src/consultations), doctors only.

export const NOTE_FIELDS = ["complaint", "history", "examination", "diagnosis", "plan"] as const;
export const VITAL_FIELDS = [
	"systolic",
	"diastolic",
	"heartRate",
	"temperature",
	"spo2",
	"weightKg",
	"heightCm",
	"glycemia",
] as const;

export type NoteField = (typeof NOTE_FIELDS)[number];
export type VitalField = (typeof VITAL_FIELDS)[number];

export type Consultation = Record<NoteField, string | null> &
	Record<VitalField, number | null> & { id: string; appointmentId: string; updatedAt: string };

/** GET /consultations/visit/:id — the visit, and its notes once something was written. */
export type Visit = { appointment: Appointment; consultation: Consultation | null };

/** GET /consultations?patientId= — past notes, newest first. */
export type PastConsultation = Consultation & { date: string; act: string | null; practitioner: string | null };

/** The form keeps text: what the doctor typed, saved as is. */
export type ConsultationDraft = Record<NoteField | VitalField, string>;

export const toDraft = (c: Consultation | null): ConsultationDraft =>
	Object.fromEntries(
		[...NOTE_FIELDS, ...VITAL_FIELDS].map((f) => [f, c?.[f] == null ? "" : String(c[f])]),
	) as ConsultationDraft;

/** "1,5" or "1.5" → 1.5; empty or not a number → null. */
export const toNumber = (value: string) => {
	const n = Number(value.trim().replace(",", "."));
	return value.trim() === "" || Number.isNaN(n) ? null : n;
};

/** Body mass index from kg and cm, one decimal; null when either is missing. */
export function bmiOf(weightKg: number | null, heightCm: number | null) {
	if (!weightKg || !heightCm) return null;
	return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export type BmiCategory = "under" | "normal" | "over" | "obese";
export const bmiCategory = (bmi: number): BmiCategory =>
	bmi < 18.5 ? "under" : bmi < 25 ? "normal" : bmi < 30 ? "over" : "obese";

/**
 * A constant outside the usual adult range: shown in amber so it catches the
 * eye, never blocking (the doctor decides).
 */
export function isAbnormal(field: VitalField, value: number | null) {
	if (value === null) return false;
	switch (field) {
		case "systolic":
			return value >= 140 || value < 90;
		case "diastolic":
			return value >= 90 || value < 60;
		case "heartRate":
			return value > 100 || value < 50;
		case "temperature":
			return value >= 38 || value < 35.5;
		case "spo2":
			return value < 95;
		case "glycemia":
			return value >= 1.26 || value < 0.7;
		default:
			return false;
	}
}
