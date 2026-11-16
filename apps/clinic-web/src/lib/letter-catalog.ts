import type { LetterKind } from "./letters";

/**
 * Cabinova's examples of letters and comptes rendus, to start from instead
 * of a blank page. Written in French, as Moroccan doctors write them, with
 * the certificates' blanks ({patient}, {age}, {cin}, {date}, {docteur})
 * filled in when picked; "……" is left for what only the doctor knows.
 */
export type LetterExample = {
	key: string;
	kind: LetterKind;
	name: string;
	/** Other words a doctor may type, accents and case aside. */
	keywords: string;
	body: string;
};

const p = (text: string) => `<p>${text}</p>`;
const b = (text: string) => `<p><strong>${text}</strong></p>`;
const ul = (...items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const CONFRERE = p("Cher(e) confrère,");
const THANKS = p("Je vous remercie de bien vouloir le/la prendre en charge et vous prie d’agréer, cher(e) confrère, l’expression de mes salutations confraternelles.");
const SIGN = p("{docteur}");

export const LETTER_EXAMPLES: LetterExample[] = [
	// ── Lettres ──
	{
		key: "referral",
		kind: "letter",
		name: "Lettre d’adressage à un confrère",
		keywords: "adresser specialiste avis orientation confrere",
		body:
			CONFRERE +
			p("Je vous adresse {patient}, âgé(e) de {age}, pour avis et prise en charge spécialisée concernant ……") +
			b("Antécédents") +
			p("……") +
			b("Histoire de la maladie") +
			p("……") +
			b("Examen clinique") +
			p("……") +
			b("Traitement en cours") +
			p("……") +
			THANKS +
			SIGN,
	},
	{
		key: "emergency",
		kind: "letter",
		name: "Lettre d’adressage aux urgences / hospitalisation",
		keywords: "urgence hopital hospitalisation transfert chu",
		body:
			p("Cher(e) confrère, service des urgences,") +
			p("Je vous adresse en urgence {patient}, âgé(e) de {age}, vu(e) ce jour le {date} en consultation pour ……") +
			b("Constantes") +
			p("TA : …… mmHg · FC : …… bpm · T° : …… °C · SpO₂ : …… %") +
			b("Examen clinique") +
			p("……") +
			b("Conduite déjà tenue") +
			p("……") +
			p("Je vous remercie de bien vouloir assurer sa prise en charge et, si nécessaire, son hospitalisation.") +
			p("Confraternellement,") +
			SIGN,
	},
	{
		key: "liaison",
		kind: "letter",
		name: "Lettre de liaison au médecin traitant",
		keywords: "retour medecin traitant generaliste suivi liaison",
		body:
			CONFRERE +
			p("J’ai vu en consultation le {date} votre patient(e) {patient}, âgé(e) de {age}, que vous m’aviez adressé(e) pour ……") +
			b("Conclusion") +
			p("……") +
			b("Traitement proposé") +
			p("……") +
			b("Suivi") +
			p("Je le/la reverrai dans …… ; je reste à votre disposition pour tout renseignement complémentaire.") +
			p("Bien confraternellement,") +
			SIGN,
	},
	{
		key: "cardio",
		kind: "letter",
		name: "Demande d’avis cardiologique",
		keywords: "cardiologue coeur ecg echocardiographie hta douleur thoracique",
		body:
			CONFRERE +
			p("Je vous adresse {patient}, âgé(e) de {age}, pour avis cardiologique devant ……") +
			b("Facteurs de risque cardiovasculaire") +
			ul("HTA : ……", "Diabète : ……", "Dyslipidémie : ……", "Tabac : ……") +
			b("Examen et ECG") +
			p("……") +
			p("Merci de me faire part de votre avis et de vos propositions thérapeutiques.") +
			p("Confraternellement,") +
			SIGN,
	},
	{
		key: "imaging",
		kind: "letter",
		name: "Demande d’examen radiologique",
		keywords: "radiologue radio echographie scanner irm imagerie",
		body:
			CONFRERE +
			p("Merci de bien vouloir réaliser chez {patient}, âgé(e) de {age}, l’examen suivant : ……") +
			b("Renseignements cliniques") +
			p("……") +
			b("Question posée") +
			p("……") +
			p("Avec mes remerciements,") +
			SIGN,
	},
	{
		key: "physio",
		kind: "letter",
		name: "Prescription de séances de kinésithérapie",
		keywords: "kine kinesitherapie reeducation seances physiotherapie",
		body:
			p("Cher(e) confrère kinésithérapeute,") +
			p("Je vous adresse {patient}, âgé(e) de {age}, pour …… séances de rééducation, à raison de …… séances par semaine.") +
			b("Diagnostic") +
			p("……") +
			b("Objectifs") +
			p("……") +
			p("Merci de me tenir informé(e) de l’évolution.") +
			SIGN,
	},
	{
		key: "work",
		kind: "letter",
		name: "Lettre au médecin du travail",
		keywords: "travail employeur aptitude poste amenagement",
		body:
			p("Cher(e) confrère, médecin du travail,") +
			p("Je suis amené(e) à vous écrire au sujet de {patient}, âgé(e) de {age}, que je suis pour ……") +
			p("Son état de santé justifie, à mon avis, ……") +
			p("Je reste à votre disposition pour en discuter.") +
			p("Confraternellement,") +
			SIGN,
	},
	{
		key: "coverage",
		kind: "letter",
		name: "Demande de prise en charge (mutuelle / AMO)",
		keywords: "mutuelle amo cnss cnops assurance prise en charge accord",
		body:
			p("Madame, Monsieur,") +
			p("Je soussigné(e), {docteur}, sollicite la prise en charge pour {patient}, CIN {cin}, de ……") +
			b("Motif médical") +
			p("……") +
			p("Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.") +
			SIGN,
	},

	// ── Comptes rendus ──
	{
		key: "consultation",
		kind: "report",
		name: "Compte rendu de consultation",
		keywords: "consultation general examen conclusion",
		body:
			p("Patient(e) : {patient}, {age}. Consultation du {date}.") +
			b("Motif de consultation") +
			p("……") +
			b("Antécédents") +
			p("……") +
			b("Examen clinique") +
			p("……") +
			b("Conclusion") +
			p("……") +
			b("Conduite à tenir") +
			p("……"),
	},
	{
		key: "followup",
		kind: "report",
		name: "Compte rendu de suivi (diabète / HTA)",
		keywords: "suivi chronique diabete hta hypertension controle",
		body:
			p("Consultation de suivi du {date} pour {patient}, {age}.") +
			b("Constantes") +
			p("TA : …… mmHg · Poids : …… kg · IMC : ……") +
			b("Derniers résultats") +
			ul("Glycémie à jeun : ……", "HbA1c : ……", "Bilan lipidique : ……", "Créatinine : ……") +
			b("Observance et tolérance du traitement") +
			p("……") +
			b("Conclusion et ajustements") +
			p("……") +
			b("Prochain contrôle") +
			p("Dans …… mois, avec ……"),
	},
	{
		key: "pediatric",
		kind: "report",
		name: "Compte rendu de consultation pédiatrique",
		keywords: "enfant pediatrie nourrisson croissance vaccin",
		body:
			p("Enfant : {patient}, {age}. Consultation du {date}.") +
			b("Motif") +
			p("……") +
			b("Croissance") +
			p("Poids : …… kg · Taille : …… cm · Périmètre crânien : …… cm") +
			b("Vaccinations") +
			p("……") +
			b("Examen clinique") +
			p("……") +
			b("Conclusion et conseils aux parents") +
			p("……"),
	},
	{
		key: "ecg",
		kind: "report",
		name: "Compte rendu d’ECG",
		keywords: "ecg electrocardiogramme rythme coeur",
		body:
			p("ECG réalisé le {date} chez {patient}, {age}.") +
			ul("Rythme : ……", "Fréquence : …… bpm", "Axe : ……", "PR : …… ms · QRS : …… ms · QTc : …… ms", "Repolarisation : ……") +
			b("Conclusion") +
			p("……"),
	},
	{
		key: "abdominal-us",
		kind: "report",
		name: "Compte rendu d’échographie abdominale",
		keywords: "echographie abdominale foie vesicule reins",
		body:
			p("Échographie abdominale réalisée le {date} chez {patient}, {age}.") +
			b("Indication") +
			p("……") +
			b("Résultats") +
			ul("Foie : ……", "Vésicule et voies biliaires : ……", "Pancréas : ……", "Rate : ……", "Reins : ……") +
			b("Conclusion") +
			p("……"),
	},
	{
		key: "preop",
		kind: "report",
		name: "Compte rendu de bilan préopératoire",
		keywords: "preoperatoire chirurgie anesthesie aptitude operation",
		body:
			p("Bilan préopératoire de {patient}, {age}, le {date}, en vue de ……") +
			b("Antécédents et traitements") +
			p("……") +
			b("Examen clinique") +
			p("……") +
			b("Examens complémentaires") +
			p("……") +
			b("Conclusion") +
			p("Pas de contre-indication apparente à l’intervention / ……"),
	},
	{
		key: "procedure",
		kind: "report",
		name: "Compte rendu de soins / petite chirurgie",
		keywords: "suture soins pansement incision geste petite chirurgie",
		body:
			p("Geste réalisé le {date} chez {patient}, {age}.") +
			b("Indication") +
			p("……") +
			b("Description du geste") +
			p("……") +
			b("Suites et consignes") +
			p("……"),
	},
];
