import { z } from "zod";
import type { Sex } from "./patients";

// Types, labels and form schemas of the EMR API (apps/api/src/consultations).

export type ConsultationStatus = "draft" | "completed";

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
	draft: "En cours",
	completed: "Clôturée",
};

type PatientRef = {
	id: string;
	firstName: string;
	lastName: string;
	fileNumber: number;
	sex: Sex;
	birthDate: string | null;
};

export type ConsultationRow = {
	id: string;
	status: ConsultationStatus;
	startedAt: string;
	reason: string | null;
	diagnosis: string | null;
	patient: PatientRef;
	practitioner: { id: string; name: string };
};

export type ConsultationsPage = { data: ConsultationRow[]; total: number; pageCount: number };

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type MedicalProfile = {
	bloodGroup: BloodGroup | null;
	allergies: string | null;
	chronicConditions: string | null;
	medicalHistory: string | null;
	surgicalHistory: string | null;
	familyHistory: string | null;
	currentTreatments: string | null;
	updatedAt: string | null;
};

export const PROFILE_FIELDS = [
	{ name: "allergies", label: "Allergies" },
	{ name: "chronicConditions", label: "Maladies chroniques" },
	{ name: "currentTreatments", label: "Traitements en cours" },
	{ name: "medicalHistory", label: "Antécédents médicaux" },
	{ name: "surgicalHistory", label: "Antécédents chirurgicaux" },
	{ name: "familyHistory", label: "Antécédents familiaux" },
] as const satisfies { name: keyof MedicalProfile; label: string }[];

export type Consultation = {
	id: string;
	status: ConsultationStatus;
	startedAt: string;
	appointmentId: string | null;
	reason: string | null;
	history: string | null;
	examination: string | null;
	diagnosis: string | null;
	plan: string | null;
	weightKg: number | null;
	heightCm: number | null;
	temperatureC: number | null;
	systolic: number | null;
	diastolic: number | null;
	heartRate: number | null;
	spo2: number | null;
	glycemia: number | null;
	completedAt: string | null;
	updatedAt: string;
	patient: PatientRef;
	practitioner: { id: string; name: string };
	medicalProfile: MedicalProfile;
};

/** Vital signs: form field, label, unit, plausibility bounds (same as the API), integer or decimal. */
export const VITALS = [
	{ name: "weightKg", label: "Poids", unit: "kg", min: 0.3, max: 400, step: 0.1 },
	{ name: "heightCm", label: "Taille", unit: "cm", min: 20, max: 260, step: 0.5 },
	{ name: "temperatureC", label: "Température", unit: "°C", min: 30, max: 45, step: 0.1 },
	{ name: "systolic", label: "TA systolique", unit: "mmHg", min: 40, max: 300, step: 1 },
	{ name: "diastolic", label: "TA diastolique", unit: "mmHg", min: 20, max: 200, step: 1 },
	{ name: "heartRate", label: "Fréquence cardiaque", unit: "bpm", min: 20, max: 260, step: 1 },
	{ name: "spo2", label: "SpO₂", unit: "%", min: 50, max: 100, step: 1 },
	{ name: "glycemia", label: "Glycémie", unit: "g/L", min: 0.2, max: 10, step: 0.01 },
] as const;
export type VitalName = (typeof VITALS)[number]["name"];

/** Body mass index, 1 decimal; null without weight and height. */
export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
	if (!weightKg || !heightCm) return null;
	return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export const TEXT_SECTIONS = [
	{ name: "history", label: "Anamnèse", placeholder: "Histoire de la maladie, symptômes, chronologie…" },
	{ name: "examination", label: "Examen clinique", placeholder: "Examen général et par appareil…" },
	{ name: "diagnosis", label: "Diagnostic", placeholder: "Diagnostic retenu ou hypothèses…" },
	{ name: "plan", label: "Conduite à tenir", placeholder: "Traitement, examens complémentaires, suivi…" },
] as const;

/** Inputs keep strings ("" = not measured); converted to numbers on submit. */
const vital = (min: number, max: number, integer: boolean) =>
	z
		.string()
		.trim()
		.refine((v) => {
			if (!v) return true;
			const n = Number(v.replace(",", "."));
			return Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
		}, `Entre ${min} et ${max}`);

export const consultationSchema = z.object({
	reason: z.string().trim().max(300),
	history: z.string().max(10_000),
	examination: z.string().max(10_000),
	diagnosis: z.string().max(10_000),
	plan: z.string().max(10_000),
	...(Object.fromEntries(VITALS.map((v) => [v.name, vital(v.min, v.max, v.step === 1)])) as Record<
		VitalName,
		ReturnType<typeof vital>
	>),
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

export const toConsultationInput = (c: Consultation): ConsultationInput => ({
	reason: c.reason ?? "",
	history: c.history ?? "",
	examination: c.examination ?? "",
	diagnosis: c.diagnosis ?? "",
	plan: c.plan ?? "",
	...(Object.fromEntries(VITALS.map((v) => [v.name, c[v.name] == null ? "" : String(c[v.name])])) as Record<
		VitalName,
		string
	>),
});

/** Form values → API body (vitals as numbers or null). */
export const toConsultationBody = (values: ConsultationInput) => ({
	...values,
	...Object.fromEntries(
		VITALS.map((v) => [v.name, values[v.name] ? Number(values[v.name].replace(",", ".")) : null]),
	),
});
