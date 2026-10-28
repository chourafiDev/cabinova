import { differenceInYears, parseISO } from "date-fns";
import { z } from "zod";

// Types, labels and form schema of the Patients API (clinic-api/src/patients).

export const SEX_LABELS = { male: "Homme", female: "Femme" } as const;
export type Sex = keyof typeof SEX_LABELS;

/** Moroccan health coverage schemes. */
export const COVERAGE_LABELS = {
	none: "Aucune",
	cnss: "CNSS (AMO)",
	cnops: "CNOPS",
	amo_tadamon: "AMO Tadamon",
	far: "FAR",
	private: "Assurance privée",
} as const;
export type Coverage = keyof typeof COVERAGE_LABELS;

export type PatientRow = {
	id: string;
	fileNumber: number;
	firstName: string;
	lastName: string;
	sex: Sex;
	birthDate: string | null;
	cin: string | null;
	phone: string | null;
	city: string | null;
	coverage: Coverage;
	archivedAt: string | null;
	createdAt: string;
};

export type Patient = PatientRow & {
	email: string | null;
	address: string | null;
	coverageNumber: string | null;
	insurer: string | null;
	emergencyContactName: string | null;
	emergencyContactPhone: string | null;
	notes: string | null;
	updatedAt: string;
};

export type PatientsPage = { data: PatientRow[]; total: number; pageCount: number };

export const fullName = (p: Pick<Patient, "firstName" | "lastName">) => `${p.lastName.toUpperCase()} ${p.firstName}`;

/** "N° 00042" */
export const formatFileNumber = (n: number) => `N° ${String(n).padStart(5, "0")}`;

export const ageOf = (birthDate: string | null) =>
	birthDate ? differenceInYears(new Date(), parseISO(birthDate)) : null;

/** "0612345678" → "06 12 34 56 78"; other formats unchanged. */
export function formatPhone(phone: string | null) {
	if (!phone) return "";
	return /^0\d{9}$/.test(phone) ? phone.replace(/(\d{2})(?=\d)/g, "$1 ") : phone;
}

const optional = (max: number) => z.string().trim().max(max);
const phone = z
	.string()
	.trim()
	.refine((v) => !v || /^\+?\d{9,15}$/.test(v.replace(/(?!^\+)\D/g, "")), "Téléphone invalide");

/** Patient form. Empty strings mean "not provided" (the API stores null). */
export const patientSchema = z.object({
	lastName: z.string().trim().min(1, "Nom requis").max(80),
	firstName: z.string().trim().min(1, "Prénom requis").max(80),
	sex: z.enum(["male", "female"], { error: "Sexe requis" }),
	birthDate: z
		.string()
		.refine((v) => !v || (v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Date invalide"),
	cin: z
		.string()
		.trim()
		.toUpperCase()
		.refine((v) => !v || /^[A-Z]{1,2}\d{1,7}$/.test(v), "CIN invalide (ex. BK123456)"),
	phone,
	email: z.union([z.literal(""), z.email("E-mail invalide")]),
	address: optional(300),
	city: optional(80),
	coverage: z.enum(Object.keys(COVERAGE_LABELS) as [Coverage, ...Coverage[]]),
	coverageNumber: optional(50),
	insurer: optional(120),
	emergencyContactName: optional(120),
	emergencyContactPhone: phone,
	notes: optional(2000),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const EMPTY_PATIENT: PatientInput = {
	lastName: "",
	firstName: "",
	// Not chosen yet: fails validation with "Sexe requis".
	sex: "" as Sex,
	birthDate: "",
	cin: "",
	phone: "",
	email: "",
	address: "",
	city: "",
	coverage: "none",
	coverageNumber: "",
	insurer: "",
	emergencyContactName: "",
	emergencyContactPhone: "",
	notes: "",
};

export const toInput = (p: Patient): PatientInput => ({
	lastName: p.lastName,
	firstName: p.firstName,
	sex: p.sex,
	birthDate: p.birthDate ?? "",
	cin: p.cin ?? "",
	phone: p.phone ?? "",
	email: p.email ?? "",
	address: p.address ?? "",
	city: p.city ?? "",
	coverage: p.coverage,
	coverageNumber: p.coverageNumber ?? "",
	insurer: p.insurer ?? "",
	emergencyContactName: p.emergencyContactName ?? "",
	emergencyContactPhone: p.emergencyContactPhone ?? "",
	notes: p.notes ?? "",
});

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** Antécédents, doctors only (absent from the API response for other staff). */
export type MedicalProfile = {
	bloodGroup: BloodGroup | null;
	allergies: string | null;
	chronicConditions: string | null;
	medicalHistory: string | null;
	surgicalHistory: string | null;
	familyHistory: string | null;
	currentTreatments: string | null;
	updatedAt: string;
};

/** The text fields of the medical profile, in display order. */
export const PROFILE_FIELDS = [
	{ name: "allergies", label: "Allergies", placeholder: "Médicaments, aliments… ou « Aucune connue »", alert: true },
	{ name: "currentTreatments", label: "Traitements en cours", placeholder: "Médicament, dose, fréquence" },
	{ name: "chronicConditions", label: "Maladies chroniques", placeholder: "Diabète, HTA, asthme…" },
	{ name: "medicalHistory", label: "Antécédents médicaux" },
	{ name: "surgicalHistory", label: "Antécédents chirurgicaux" },
	{ name: "familyHistory", label: "Antécédents familiaux" },
] as const satisfies readonly { name: keyof MedicalProfile; label: string; placeholder?: string; alert?: boolean }[];

/** GET /patients/:id — `medicalProfile` only for doctors (undefined otherwise, null when empty). */
export type PatientFile = Patient & { medicalProfile?: MedicalProfile | null };

/** Roles that see medical data, as in clinic-api auth/roles.ts. */
export const isMedicalRole = (role: string) => role === "owner" || role === "doctor";

/** The patient sheet on the Patients list (file, edit, new): links from anywhere. */
export const patientHref = (id: string) => `/patients?patient=${id}`;
export const NEW_PATIENT_HREF = "/patients?nouveau=1";
