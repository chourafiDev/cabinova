// Bilan biologique (clinic-api GET/POST /patients/:id/lab-results).

/** A result as the API returns it. */
export type LabResult = {
	id: string;
	name: string;
	unit: string | null;
	/** As written: "1,05", "Négatif", "< 0,5". */
	value: string;
	/** Day of the analysis, "2026-11-14". */
	takenOn: string;
	appointmentId: string | null;
	createdAt: string;
	createdBy: string | null;
};

export const labResultsKey = (patientId: string) => ["lab-results", patientId];

/** A test of the catalog: its name (as labs print it), its usual unit, other words to find it by. */
export type LabTest = { name: string; unit: string | null; keywords?: string };

/**
 * The analyses Moroccan doctors ask for most, grouped as on a lab report.
 * Names and units in French, as the labs print them (in both languages).
 */
export const LAB_CATALOG: { group: string; tests: LabTest[] }[] = [
	{
		group: "Glucides",
		tests: [
			{ name: "Glycémie à jeun", unit: "g/L", keywords: "glucose sucre gaj" },
			{ name: "Glycémie postprandiale", unit: "g/L", keywords: "glucose sucre gpp apres repas" },
			{ name: "HbA1c", unit: "%", keywords: "hemoglobine glyquee glycosylee" },
		],
	},
	{
		group: "Bilan lipidique",
		tests: [
			{ name: "Cholestérol total", unit: "g/L", keywords: "ct lipides" },
			{ name: "HDL-cholestérol", unit: "g/L", keywords: "hdl lipides" },
			{ name: "LDL-cholestérol", unit: "g/L", keywords: "ldl lipides" },
			{ name: "Triglycérides", unit: "g/L", keywords: "tg lipides" },
		],
	},
	{
		group: "Hématologie",
		tests: [
			{ name: "Hémoglobine", unit: "g/dL", keywords: "nfs hb anemie" },
			{ name: "Globules rouges", unit: "10⁶/mm³", keywords: "nfs gr hematies" },
			{ name: "Globules blancs", unit: "/mm³", keywords: "nfs gb leucocytes" },
			{ name: "Hématocrite", unit: "%", keywords: "nfs ht" },
			{ name: "VGM", unit: "fL", keywords: "nfs volume globulaire" },
			{ name: "Plaquettes", unit: "/mm³", keywords: "nfs plq thrombocytes" },
			{ name: "Polynucléaires neutrophiles", unit: "/mm³", keywords: "nfs pnn" },
			{ name: "Lymphocytes", unit: "/mm³", keywords: "nfs" },
			{ name: "Vitesse de sédimentation", unit: "mm/h", keywords: "vs inflammation" },
		],
	},
	{
		group: "Coagulation",
		tests: [
			{ name: "Taux de prothrombine", unit: "%", keywords: "tp" },
			{ name: "INR", unit: null, keywords: "avk sintrom" },
			{ name: "TCA", unit: "s", keywords: "temps cephaline" },
		],
	},
	{
		group: "Fonction rénale",
		tests: [
			{ name: "Urée", unit: "g/L", keywords: "uree rein" },
			{ name: "Créatinine", unit: "mg/L", keywords: "creat rein" },
			{ name: "Clairance de la créatinine (DFG)", unit: "mL/min/1,73 m²", keywords: "dfg mdrd ckd epi rein" },
			{ name: "Acide urique", unit: "mg/L", keywords: "uricemie goutte" },
		],
	},
	{
		group: "Ionogramme",
		tests: [
			{ name: "Sodium", unit: "mmol/L", keywords: "na natremie iono" },
			{ name: "Potassium", unit: "mmol/L", keywords: "k kaliemie iono" },
			{ name: "Chlore", unit: "mmol/L", keywords: "cl chloremie iono" },
			{ name: "Calcium", unit: "mg/L", keywords: "ca calcemie" },
			{ name: "Magnésium", unit: "mg/L", keywords: "mg magnesemie" },
			{ name: "Phosphore", unit: "mg/L", keywords: "phosphoremie" },
		],
	},
	{
		group: "Bilan hépatique",
		tests: [
			{ name: "ASAT (TGO)", unit: "UI/L", keywords: "transaminases foie sgot" },
			{ name: "ALAT (TGP)", unit: "UI/L", keywords: "transaminases foie sgpt" },
			{ name: "Gamma-GT", unit: "UI/L", keywords: "ggt foie" },
			{ name: "Phosphatases alcalines", unit: "UI/L", keywords: "pal foie" },
			{ name: "Bilirubine totale", unit: "mg/L", keywords: "foie ictere" },
			{ name: "Albumine", unit: "g/L", keywords: "proteines" },
		],
	},
	{
		group: "Inflammation",
		tests: [{ name: "CRP", unit: "mg/L", keywords: "proteine c reactive inflammation" }],
	},
	{
		group: "Thyroïde",
		tests: [
			{ name: "TSH", unit: "µUI/mL", keywords: "thyroide tshus" },
			{ name: "T4 libre", unit: "pmol/L", keywords: "thyroide ft4" },
			{ name: "T3 libre", unit: "pmol/L", keywords: "thyroide ft3" },
		],
	},
	{
		group: "Fer et vitamines",
		tests: [
			{ name: "Fer sérique", unit: "µg/dL", keywords: "sideremie" },
			{ name: "Ferritine", unit: "ng/mL", keywords: "ferritinemie" },
			{ name: "Vitamine D (25-OH)", unit: "ng/mL", keywords: "vit d" },
			{ name: "Vitamine B12", unit: "pg/mL", keywords: "cobalamine" },
		],
	},
	{
		group: "Hormones et marqueurs",
		tests: [
			{ name: "PSA total", unit: "ng/mL", keywords: "prostate" },
			{ name: "β-HCG", unit: "mUI/mL", keywords: "bhcg grossesse beta" },
		],
	},
	{
		group: "Urines",
		tests: [
			{ name: "ECBU", unit: null, keywords: "urines infection cytobacteriologique" },
			{ name: "Protéinurie des 24 h", unit: "g/24 h", keywords: "urines proteines" },
			{ name: "Microalbuminurie", unit: "mg/24 h", keywords: "urines albumine diabete" },
		],
	},
	{
		group: "Sérologies",
		tests: [
			{ name: "Antigène HBs", unit: null, keywords: "hepatite b serologie" },
			{ name: "Sérologie hépatite C", unit: null, keywords: "vhc hcv serologie" },
			{ name: "Sérologie VIH", unit: null, keywords: "hiv sida serologie" },
			{ name: "Sérologie toxoplasmose", unit: null, keywords: "toxo grossesse serologie" },
			{ name: "Sérologie rubéole", unit: null, keywords: "rubeole grossesse serologie" },
		],
	},
];

/** "1,05" → 1.05; a value that isn't a number ("Négatif") → null. */
export const labNumeric = (value: string) => {
	const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
	return /\d/.test(value) && !Number.isNaN(n) ? n : null;
};

const CATALOG_ORDER = new Map(LAB_CATALOG.flatMap((g) => g.tests).map((test, i) => [test.name, i]));

/** The catalog's order (as on a lab report); tests not in it come after, by name. */
export const byCatalogOrder = (a: string, b: string) =>
	(CATALOG_ORDER.get(a) ?? 999) - (CATALOG_ORDER.get(b) ?? 999) || a.localeCompare(b);

/** Accents and case aside, for searching test names. */
export const foldLab = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
