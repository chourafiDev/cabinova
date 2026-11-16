// Bilan biologique (clinic-api /lab-requests): the analyses the doctor asks for.
import type { Sex } from "./patients";
import type { PrintedPrescription } from "./prescriptions";
import { textToHtml } from "./rich-text";

/** GET /lab-requests?patientId= — newest first. */
export type LabRequest = {
	id: string;
	/** Sanitized HTML, as printed. */
	body: string;
	appointmentId: string | null;
	createdAt: string;
	updatedAt: string;
	practitionerId: string | null;
	practitioner: string | null;
};

/** GET /lab-requests/:id/print. */
export type PrintedLabRequest = LabRequest & {
	patient: { firstName: string; lastName: string; sex: Sex; birthDate: string | null; cin: string | null; fileNumber: number };
	space: PrintedPrescription["space"];
	cabinet: PrintedPrescription["cabinet"];
};

/** GET /lab-request-models — the doctor's own bilans. */
export type LabRequestModel = { id: string; name: string; body: string };

export const labRequestsKey = (patientId: string) => ["lab-requests", patientId];
export const LAB_MODELS_KEY = ["lab-request-models"];

/**
 * A bilan of Cabinova's list: its name, and the analyses it stands for when
 * it is a group (Bilan lipidique → CT, HDL, LDL, TG). In French, as labs
 * and doctors write them in Morocco.
 */
export type BuiltInBilan = { key: string; name: string; analyses?: string[]; keywords?: string };

export const BUILT_IN_BILANS: BuiltInBilan[] = [
	{ key: "nfs", name: "NFS (numération formule sanguine)", keywords: "hemogramme globules plaquettes hemoglobine" },
	{ key: "vs", name: "Vitesse de sédimentation (VS)", keywords: "inflammation" },
	{ key: "crp", name: "CRP", keywords: "proteine c reactive inflammation" },
	{ key: "gaj", name: "Glycémie à jeun", keywords: "sucre glucose diabete" },
	{ key: "gpp", name: "Glycémie postprandiale", keywords: "sucre glucose diabete" },
	{ key: "hba1c", name: "HbA1c", keywords: "hemoglobine glyquee diabete" },
	{
		key: "lipides",
		name: "Bilan lipidique",
		analyses: ["Cholestérol total", "HDL-cholestérol", "LDL-cholestérol", "Triglycérides"],
		keywords: "cholesterol",
	},
	{
		key: "renal",
		name: "Bilan rénal",
		analyses: ["Urée", "Créatinine", "Clairance de la créatinine (DFG)"],
		keywords: "rein uree creatinine",
	},
	{ key: "uric", name: "Acide urique", keywords: "uricemie goutte" },
	{
		key: "hepatique",
		name: "Bilan hépatique",
		analyses: ["ASAT (TGO)", "ALAT (TGP)", "Gamma-GT", "Phosphatases alcalines", "Bilirubine totale et conjuguée"],
		keywords: "foie transaminases",
	},
	{
		key: "iono",
		name: "Ionogramme sanguin",
		analyses: ["Sodium", "Potassium", "Chlore", "Bicarbonates"],
		keywords: "na k",
	},
	{
		key: "phosphocalcique",
		name: "Bilan phosphocalcique",
		analyses: ["Calcémie", "Phosphorémie", "Vitamine D (25-OH)"],
		keywords: "calcium",
	},
	{ key: "thyroide", name: "Bilan thyroïdien", analyses: ["TSH", "T4 libre"], keywords: "tsh t4 t3" },
	{
		key: "martial",
		name: "Bilan martial",
		analyses: ["Fer sérique", "Ferritine", "Coefficient de saturation de la transferrine"],
		keywords: "fer anemie",
	},
	{ key: "vitd", name: "Vitamine D (25-OH)", keywords: "vit d" },
	{ key: "b12", name: "Vitamine B12 et folates", keywords: "cobalamine acide folique" },
	{
		key: "coagulation",
		name: "Bilan de coagulation",
		analyses: ["TP / INR", "TCA", "Fibrinogène"],
		keywords: "hemostase tp inr",
	},
	{ key: "ecbu", name: "ECBU (examen cytobactériologique des urines)", keywords: "urines infection" },
	{ key: "proteinurie", name: "Protéinurie des 24 h", keywords: "urines" },
	{ key: "microalb", name: "Microalbuminurie", keywords: "urines diabete" },
	{ key: "psa", name: "PSA total et libre", keywords: "prostate" },
	{ key: "bhcg", name: "β-HCG plasmatiques", keywords: "grossesse beta" },
	{
		key: "prenatal",
		name: "Bilan prénatal",
		analyses: [
			"Groupe sanguin, Rhésus, RAI",
			"NFS",
			"Glycémie à jeun",
			"Sérologies : toxoplasmose, rubéole, syphilis (TPHA-VDRL), hépatite B (Ag HBs), VIH",
			"ECBU",
		],
		keywords: "grossesse enceinte",
	},
	{
		key: "hepatites",
		name: "Sérologies hépatites",
		analyses: ["Ag HBs", "Anticorps anti-HBs", "Anticorps anti-HBc", "Sérologie hépatite C"],
		keywords: "vhb vhc",
	},
	{ key: "vih", name: "Sérologie VIH", keywords: "hiv sida" },
	{ key: "groupe", name: "Groupe sanguin et Rhésus", keywords: "abo" },
];

/** What the doctor picked: one of Cabinova's bilans or one of their own. */
export type PickedBilan = { kind: "builtIn"; bilan: BuiltInBilan } | { kind: "mine"; model: LabRequestModel };

export const pickedKey = (p: PickedBilan) => (p.kind === "builtIn" ? p.bilan.key : p.model.id);

/** One line of the list: the bilan, then its analyses when it is a group. */
const line = (b: BuiltInBilan) => (b.analyses ? `${b.name} : ${b.analyses.join(", ")}` : b.name);

/**
 * The text of the request from what was picked, in the order picked:
 * Cabinova's bilans share the list (continuing a custom bilan's list when
 * picked after it), each of the doctor's own comes under its name (no heading: the page is already
 * titled "Bilan biologique"). The doctor may edit it afterwards.
 */
export function composeBody(picked: PickedBilan[]) {
	const esc = (text: string) => textToHtml(text).replace(/^<p>|<\/p>$/g, "");
	const parts: string[] = [];
	let list: string[] = [];
	const closeList = () => {
		if (list.length) parts.push(`<ul>${list.join("")}</ul>`);
		list = [];
	};
	for (const p of picked) {
		if (p.kind === "builtIn") list.push(`<li>${esc(line(p.bilan))}</li>`);
		else {
			closeList();
			parts.push(`<p><strong>${esc(p.model.name)}</strong></p>${p.model.body}`);
		}
	}
	closeList();
	return joinLists(parts.join(""));
}

/**
 * Two lists back to back become one: bilans picked after a custom bilan
 * continue its list instead of starting another one below a gap.
 */
export const joinLists = (html: string) =>
	html
		// An empty bullet (a custom bilan saved with a blank last line) isn't a line.
		.replace(/<li>(?:<p>\s*<\/p>)?<\/li>/g, "")
		// Nor is an empty paragraph between two lists.
		.replace(/<\/ul>(?:\s|<p>\s*<\/p>)*<ul>/g, "");
