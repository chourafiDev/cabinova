import type { Point } from "@/app/(dossier)/dossier/[patientId]/_components/trends-card";
import { bmiOf } from "./consultations";
import type { BloodGroup } from "./patients";

// Constantes taken by the staff (clinic-api GET/POST /patients/:id/vitals).

export const MEASURES = {
	weightKg: { unit: "kg", min: 0.5, max: 400 },
	heightCm: { unit: "cm", min: 30, max: 250 },
	temperatureC: { unit: "°C", min: 30, max: 45 },
	glycemia: { unit: "g/L", min: 0.2, max: 6 },
	glycemiaPostprandial: { unit: "g/L", min: 0.2, max: 8 },
	hba1c: { unit: "%", min: 3, max: 20 },
	bpRightSystolic: { unit: "mmHg", min: 50, max: 300 },
	bpRightDiastolic: { unit: "mmHg", min: 20, max: 200 },
	bpLeftSystolic: { unit: "mmHg", min: 50, max: 300 },
	bpLeftDiastolic: { unit: "mmHg", min: 20, max: 200 },
	heartRate: { unit: "bpm", min: 20, max: 250 },
	spo2: { unit: "%", min: 50, max: 100 },
	waistCm: { unit: "cm", min: 10, max: 250 },
	headCircumferenceCm: { unit: "cm", min: 10, max: 100 },
	abdominalCircumferenceCm: { unit: "cm", min: 10, max: 250 },
} as const;
export type Measure = keyof typeof MEASURES;

/** Whole numbers only (mmHg, beats, %). */
export const INTEGER_MEASURES = new Set<Measure>([
	"bpRightSystolic",
	"bpRightDiastolic",
	"bpLeftSystolic",
	"bpLeftDiastolic",
	"heartRate",
	"spo2",
]);

/** The form's sections, as the cabinet asked for them. */
export const SECTIONS = [
	{ key: "general", measures: ["weightKg", "heightCm", "temperatureC"] },
	{ key: "endocrinology", measures: ["glycemia", "glycemiaPostprandial", "hba1c"] },
	{ key: "cardio", measures: ["heartRate", "spo2"] },
	{ key: "other", measures: ["waistCm", "headCircumferenceCm", "abdominalCircumferenceCm"] },
] as const satisfies readonly { key: string; measures: readonly Measure[] }[];

export const ARMS = ["Right", "Left"] as const;

export type VitalSigns = Record<Measure, number | null> & {
	id: string;
	measuredAt: string;
	recordedById: string | null;
	recordedBy: string | null;
	bloodGroup: BloodGroup | null;
	note: string | null;
};

export const vitalsKey = (patientId: string) => ["patient-vitals", patientId];

/** A staff measurement as a point of the dossier's curves (right arm first). */
export const toPoint = (v: VitalSigns): Point => ({
	date: v.measuredAt,
	systolic: v.bpRightSystolic ?? v.bpLeftSystolic,
	diastolic: v.bpRightSystolic != null ? v.bpRightDiastolic : v.bpLeftDiastolic,
	heartRate: v.heartRate,
	temperature: v.temperatureC,
	spo2: v.spo2,
	weightKg: v.weightKg,
	heightCm: v.heightCm,
	glycemia: v.glycemia,
	glycemiaPostprandial: v.glycemiaPostprandial,
	hba1c: v.hba1c,
});

/** IMC of a measurement, with the last known height when it wasn't taken again. */
export const bmiFor = (v: VitalSigns, history: VitalSigns[]) =>
	bmiOf(v.weightKg, v.heightCm ?? history.find((h) => h.heightCm != null && h.measuredAt <= v.measuredAt)?.heightCm ?? null);
