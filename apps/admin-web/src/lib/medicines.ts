// Types and labels of the medicines API (apps/admin-api/src/medicines).

export type Availability = "marketed" | "not_marketed" | "withdrawn";

export const AVAILABILITY_LABELS: Record<Availability | "inactive", string> = {
	marketed: "Commercialisé",
	not_marketed: "Non commercialisé",
	withdrawn: "Retiré / suspendu",
	inactive: "Absent du dernier fichier",
};

export const AVAILABILITY_TONES: Record<Availability | "inactive", string> = {
	marketed: "bg-emerald-50 text-emerald-700",
	not_marketed: "bg-muted text-muted-foreground",
	withdrawn: "bg-red-50 text-red-700",
	inactive: "bg-amber-50 text-amber-800",
};

export type MedicationImport = {
	id: string;
	fileName: string;
	status: "running" | "success" | "failed";
	rowsRead: number;
	rowsInserted: number;
	rowsUpdated: number;
	rowsDeactivated: number;
	error: string | null;
	importedBy: string | null;
	importedByName: string | null;
	startedAt: string;
	finishedAt: string | null;
};

export type MedicinesOverview =
	| { configured: false }
	| {
			configured: true;
			active: number;
			inactive: number;
			withPrice: number;
			byAvailability: Record<Availability, number>;
			lastImport: MedicationImport | null;
			running: MedicationImport | null;
	  };

export type Medication = {
	ammpsId: number;
	name: string;
	substances: string;
	dosage: string | null;
	form: string | null;
	presentation: string | null;
	lab: string | null;
	status: string | null;
	availability: Availability;
	ppv: string | null;
	ph: string | null;
	isActive: boolean;
	updatedAt: string;
};

export type MedicationsPage = { items: Medication[]; total: number; page: number; pageSize: number };

export type ImportResult = {
	import: MedicationImport;
	skipped: { line: number; reason: string }[];
	skippedTotal: number;
	duplicates: number;
};

/** "4303.00" → "4 303,00 DH". */
export const formatPrice = (value: string | null) =>
	value === null
		? "—"
		: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} DH`;
