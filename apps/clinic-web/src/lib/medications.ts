// Types of the Medications API (clinic-api/src/medications), doctors only:
// the AMMPS list merged with each doctor's own wording, favorites and
// own medicines.

export type Availability = "marketed" | "not_marketed" | "withdrawn";

/** One box of an AMMPS medicine. */
export type Presentation = {
	ammpsId: number;
	presentation: string | null;
	lab: string | null;
	ppv: string | null;
	availability: Availability;
};

/** GET /medications/search — one line per medicine. */
export type MedicationSuggestion = {
	source: "ammps" | "custom";
	key: string;
	ammpsId: number | null;
	customMedicationId: string | null;
	name: string;
	dosage: string | null;
	form: string | null;
	substances: string | null;
	/** What the ordonnance line prints. */
	label: string;
	availability: Availability | null;
	ppv: string | null;
	presentations: Presentation[];
	defaultPosology: string | null;
	defaultDuration: string | null;
	isFavorite: boolean;
	updatedByAmmps: boolean;
};

export type MedicationSearch = { items: MedicationSuggestion[]; catalog: boolean };

/** POST /medications/check-renewal */
export type RenewalWarning = { index: number; medication: string; reason: "withdrawn" | "removed" | "deleted" };

export const medicationSearchKey = (q: string) => ["medications-search", q] as const;
export const MEDICATION_FAVORITES_KEY = ["medications-favorites"] as const;

/** "13.10" → "13,10 DH". */
export const formatPpv = (ppv: string | null, locale: string) =>
	ppv === null
		? null
		: `${new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(ppv))} DH`;

/** An AMMPS medicine as the shared list has it (GET /medications/overrides → ammps). */
export type AmmpsMedicine = {
	ammpsId: number;
	name: string;
	substances: string;
	dosage: string | null;
	form: string | null;
	presentation: string | null;
	lab: string | null;
	availability: Availability;
	ppv: string | null;
	isActive: boolean;
};

/** A doctor's take on an AMMPS medicine (GET /medications/overrides). */
export type MedicationOverride = {
	ammpsId: number;
	customName: string | null;
	customDosage: string | null;
	defaultPosology: string | null;
	defaultDuration: string | null;
	isFavorite: boolean;
	isHidden: boolean;
	baseName: string | null;
	baseDosage: string | null;
	updatedAt: string;
	/** null when the medicines list is unavailable or no longer has it. */
	ammps: AmmpsMedicine | null;
	updatedByAmmps: boolean;
};

/** A doctor's own medicine, outside the AMMPS list (GET /medications/custom). */
export type CustomMedication = {
	id: string;
	name: string;
	substances: string | null;
	dosage: string | null;
	form: string | null;
	presentation: string | null;
	defaultPosology: string | null;
	defaultDuration: string | null;
	isFavorite: boolean;
};

export const MEDICATION_OVERRIDES_KEY = ["medications-overrides"] as const;
export const CUSTOM_MEDICATIONS_KEY = ["medications-custom"] as const;
