import type { CertificateKind } from "./certificates";

/**
 * Cabinova's library of certificates: the ones Moroccan doctors write most,
 * found by name ("sport", "mariage", "contagion"…). Written in French, with
 * the blanks of the models ({patient}, {docteur}, {date}, {du}, {au},
 * {jours}, {age}, {cin}); "……" is left for what only the doctor knows.
 * The printed page already carries the heading "CERTIFICAT MÉDICAL".
 */
export type CatalogEntry = {
	key: string;
	name: string;
	kind: CertificateKind;
	/** Other words a doctor may type, accents and case aside. */
	keywords: string;
	body: string;
};

const title = (text: string) => `<p><strong>${text}</strong></p>`;
const SIGN_OFF = "<p>Ce certificat est délivré à l’intéressé(e) en mains propres pour servir et valoir ce que de droit.</p>";
const EXAMINED = "<p>Je soussigné(e), {docteur}, certifie avoir examiné ce jour, le {date}, {patient}";

export const CATALOG: CatalogEntry[] = [
	{
		key: "sport",
		name: "Certificat d’aptitude à la pratique sportive",
		kind: "day",
		keywords: "sport sportif licence club competition salle natation football basket aptitude non contre indication",
		body:
			title("Certificat d’aptitude à la pratique sportive") +
			`${EXAMINED}, et atteste que son examen clinique ne révèle à ce jour aucune contre-indication apparente à la pratique de ……, en loisir et en compétition.</p>` +
			SIGN_OFF,
	},
	{
		key: "eps",
		name: "Certificat de dispense d’éducation physique (EPS)",
		kind: "period",
		keywords: "dispense eps sport ecole scolaire education physique inaptitude eleve lycee college",
		body:
			title("Certificat de dispense d’éducation physique et sportive") +
			`${EXAMINED}, dont l’état de santé contre-indique temporairement la pratique de l’éducation physique et sportive.</p>` +
			"<p>L’intéressé(e) est dispensé(e) d’EPS pendant {jours} jours, du {du} au {au} inclus.</p>" +
			SIGN_OFF,
	},
	{
		key: "goodHealth",
		name: "Certificat de bonne santé",
		kind: "day",
		keywords: "bonne sante sain aptitude generale concours dossier administratif inscription",
		body:
			title("Certificat de bonne santé") +
			`${EXAMINED}, et atteste que l’intéressé(e) ne présente à ce jour aucun signe clinique de maladie évolutive.</p>` +
			SIGN_OFF,
	},
	{
		key: "work",
		name: "Certificat d’aptitude au travail (embauche)",
		kind: "day",
		keywords: "aptitude travail emploi embauche recrutement poste employeur",
		body:
			title("Certificat d’aptitude au travail") +
			`${EXAMINED}, et atteste que l’intéressé(e) est apte, sur le plan médical, à occuper un poste de …….</p>` +
			SIGN_OFF,
	},
	{
		key: "workResume",
		name: "Certificat de reprise du travail",
		kind: "day",
		keywords: "reprise travail retour fin arret employeur",
		body:
			title("Certificat de reprise du travail") +
			`${EXAMINED}, et atteste que son état de santé lui permet de reprendre son travail à compter du {du}.</p>` +
			SIGN_OFF,
	},
	{
		key: "workExtension",
		name: "Certificat de prolongation d’arrêt de travail",
		kind: "period",
		keywords: "prolongation arret travail repos maladie conge",
		body:
			title("Certificat de prolongation d’arrêt de travail") +
			`${EXAMINED}, dont l’état de santé nécessite une prolongation de son arrêt de travail de {jours} jours, soit du {du} au {au} inclus, sauf complications.</p>` +
			SIGN_OFF,
	},
	{
		key: "workAccident",
		name: "Certificat d’accident du travail",
		kind: "period",
		keywords: "accident travail at blessure lieu de travail assurance cnss",
		body:
			title("Certificat médical d’accident du travail") +
			`${EXAMINED}, victime d’un accident du travail survenu le …… selon ses déclarations.</p>` +
			"<p>L’examen clinique retrouve : …….</p>" +
			"<p>Ces lésions nécessitent un arrêt de travail de {jours} jours, du {du} au {au} inclus, sauf complications.</p>" +
			SIGN_OFF,
	},
	{
		key: "injuries",
		name: "Certificat médical initial (coups et blessures, ITT)",
		kind: "period",
		keywords: "coups blessures agression violence itt incapacite police plainte constat accident circulation",
		body:
			title("Certificat médical initial") +
			`${EXAMINED}, qui déclare avoir été victime de …… le …….</p>` +
			"<p>L’examen clinique retrouve : …….</p>" +
			"<p>Ces lésions entraînent une incapacité totale de travail (ITT) de {jours} jours, du {du} au {au} inclus, sauf complications.</p>" +
			SIGN_OFF,
	},
	{
		key: "notContagious",
		name: "Certificat de non-contagion",
		kind: "day",
		keywords: "non contagion contagieux ecole creche collectivite eviction retour",
		body:
			title("Certificat de non-contagion") +
			`${EXAMINED}, et atteste que l’intéressé(e) ne présente à ce jour aucun signe de maladie contagieuse et peut fréquenter la collectivité.</p>` +
			SIGN_OFF,
	},
	{
		key: "community",
		name: "Certificat d’entrée en collectivité (crèche, école)",
		kind: "day",
		keywords: "collectivite creche ecole maternelle garderie inscription enfant",
		body:
			title("Certificat d’entrée en collectivité") +
			`${EXAMINED}, et atteste que son état de santé lui permet d’être admis(e) en collectivité (……).</p>` +
			SIGN_OFF,
	},
	{
		key: "schoolAbsence",
		name: "Certificat d’absence scolaire",
		kind: "period",
		keywords: "absence scolaire ecole justificatif eleve etudiant universite examen",
		body:
			title("Certificat médical d’absence scolaire") +
			`${EXAMINED}, dont l’état de santé ne lui permet pas de fréquenter son établissement scolaire pendant {jours} jours, du {du} au {au} inclus.</p>` +
			SIGN_OFF,
	},
	{
		key: "presence",
		name: "Certificat de présence (accompagnant)",
		kind: "day",
		keywords: "presence accompagnant accompagnement parent justificatif absence",
		body:
			title("Certificat de présence") +
			"<p>Je soussigné(e), {docteur}, certifie que …… a accompagné {patient} en consultation ce jour, le {date}.</p>" +
			SIGN_OFF,
	},
	{
		key: "pregnancy",
		name: "Certificat de grossesse",
		kind: "day",
		keywords: "grossesse enceinte terme accouchement maternite",
		body:
			title("Certificat de grossesse") +
			`${EXAMINED}, et atteste qu’elle est enceinte de …… semaines d’aménorrhée ; le terme est prévu le …….</p>` +
			SIGN_OFF,
	},
	{
		key: "breastfeeding",
		name: "Certificat d’allaitement",
		kind: "day",
		keywords: "allaitement allaiter bebe nourrisson maternite heure",
		body:
			title("Certificat d’allaitement") +
			`${EXAMINED}, et atteste qu’elle allaite son enfant, né(e) le …….</p>` +
			SIGN_OFF,
	},
	{
		key: "prenuptial",
		name: "Certificat médical prénuptial (mariage)",
		kind: "day",
		keywords: "prenuptial mariage zawaj adoul dossier conjoint",
		body:
			title("Certificat médical prénuptial") +
			`${EXAMINED}, âgé(e) de {age}, titulaire de la CIN n° {cin}, dans le cadre de la constitution de son dossier de mariage.</p>` +
			"<p>L’examen clinique ne révèle à ce jour aucune maladie contagieuse ni aucune affection de nature à constituer un danger pour le conjoint.</p>" +
			SIGN_OFF,
	},
	{
		key: "driving",
		name: "Certificat d’aptitude à la conduite (permis de conduire)",
		kind: "day",
		keywords: "permis conduire conduite voiture vision aptitude auto ecole",
		body:
			title("Certificat d’aptitude à la conduite") +
			`${EXAMINED}, âgé(e) de {age}, titulaire de la CIN n° {cin}, et atteste que l’intéressé(e) ne présente à ce jour aucune affection incompatible avec la conduite des véhicules de la catégorie ……, y compris sur le plan visuel.</p>` +
			SIGN_OFF,
	},
	{
		key: "travel",
		name: "Certificat d’aptitude au voyage (avion)",
		kind: "day",
		keywords: "voyage avion vol compagnie aerienne aptitude deplacement",
		body:
			title("Certificat d’aptitude au voyage") +
			`${EXAMINED}, et atteste que son état de santé ne contre-indique pas, à ce jour, un voyage par voie aérienne.</p>` +
			SIGN_OFF,
	},
	{
		key: "hajj",
		name: "Certificat d’aptitude au Hajj / à la Omra",
		kind: "day",
		keywords: "hajj omra pelerinage la mecque arabie saoudite",
		body:
			title("Certificat d’aptitude au pèlerinage") +
			`${EXAMINED}, âgé(e) de {age}, titulaire de la CIN n° {cin}, et atteste que son état de santé lui permet d’accomplir le pèlerinage (Hajj / Omra).</p>` +
			SIGN_OFF,
	},
	{
		key: "fasting",
		name: "Certificat de dispense de jeûne (Ramadan)",
		kind: "period",
		keywords: "jeune ramadan dispense sawm",
		body:
			title("Certificat de dispense de jeûne") +
			`${EXAMINED}, dont l’état de santé contre-indique le jeûne pendant {jours} jours, du {du} au {au} inclus.</p>` +
			SIGN_OFF,
	},
	{
		key: "vaccination",
		name: "Certificat de vaccination",
		kind: "day",
		keywords: "vaccination vaccin rappel carnet",
		body:
			title("Certificat de vaccination") +
			"<p>Je soussigné(e), {docteur}, certifie avoir administré ce jour, le {date}, à {patient}, le vaccin …… (lot n° ……).</p>" +
			SIGN_OFF,
	},
];

/** A text for a certificate the library doesn't have: its name, and blanks to complete. */
export const blankCertificate = (name: string, kind: CertificateKind) =>
	title(name) +
	`${EXAMINED}, et atteste que …….</p>` +
	(kind === "period" ? "<p>Durée : {jours} jours, du {du} au {au} inclus.</p>" : "") +
	SIGN_OFF;

/** Lower case, no accents: "Aptitude à la Conduite" → "aptitude a la conduite". */
export const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase();

/** Every word typed must start a word of the name or the keywords. */
export function matches(query: string, haystack: string) {
	const words = fold(haystack).split(/[^a-z0-9]+/);
	return fold(query)
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.every((q) => words.some((w) => w.startsWith(q)));
}
