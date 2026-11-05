import { addDays, differenceInCalendarDays, differenceInYears, format, parseISO } from "date-fns";
import { moroccoDay } from "@cabinova/morocco-time";
import type { Sex } from "./patients";
import type { PrintedPrescription } from "./prescriptions";

// Types and helpers of the Certificates API (clinic-api/src/certificates), doctors only.

export type CertificateKind = "day" | "period";

/** GET /certificates?patientId= — newest first, cancelled ones included. */
export type Certificate = {
	id: string;
	kind: CertificateKind;
	startsOn: string;
	endsOn: string | null;
	body: string;
	appointmentId: string | null;
	createdAt: string;
	practitionerId: string | null;
	practitioner: string | null;
	cancelledAt: string | null;
	cancelledBy: string | null;
};

/** GET /certificates/:id/print */
export type PrintedCertificate = Certificate & {
	patient: { firstName: string; lastName: string; sex: Sex; birthDate: string | null; cin: string | null; fileNumber: number };
	space: PrintedPrescription["space"];
	cabinet: PrintedPrescription["cabinet"];
};

/** GET /certificate-models — the doctor's own. */
export type CertificateModel = { id: string; name: string; body: string };

export const certificatesKey = (patientId: string) => ["certificates", patientId];
export const MODELS_KEY = ["certificate-models"];

/** Blanks a model may hold, filled in when it is used. */
export const BLANKS = ["patient", "age", "cin", "date", "du", "au", "jours", "docteur"] as const;
export type Blank = (typeof BLANKS)[number];

/**
 * Cabinova's own models, always offered: certificates are written in French
 * in Morocco, like ordonnances.
 */
export const BUILT_IN: { key: string; kind: CertificateKind; body: string }[] = [
	{
		key: "rest",
		kind: "period",
		body:
			"<p>Je soussigné(e), {docteur}, certifie avoir examiné ce jour {patient} pour une affection médicale ; " +
			"son état de santé nécessite un repos de {jours} jours, soit du {du} au {au} inclus, sauf complications.</p>" +
			"<p>Ce certificat est délivré à l’intéressé(e) en mains propres pour servir et valoir ce que de droit.</p>",
	},
	{
		key: "medical",
		kind: "day",
		body:
			"<p>Je soussigné(e), {docteur}, certifie avoir examiné ce jour, le {date}, {patient}.</p>" +
			"<p>Ce certificat est délivré à l’intéressé(e) en mains propres pour servir et valoir ce que de droit.</p>",
	},
];

const day = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

/** "M. BENABBOU Kamal" — or no title for a child. */
export function patientLine(p: { firstName: string; lastName: string; sex: Sex; birthDate: string | null }) {
	const years = p.birthDate ? differenceInYears(new Date(), parseISO(p.birthDate)) : null;
	const title = years !== null && years < 18 ? "" : p.sex === "female" ? "Mme " : "M. ";
	return `${title}${p.lastName.toUpperCase()} ${p.firstName}`;
}

/** Fills a model's blanks; a blank with nothing to put in stays as typed. */
export function fillBlanks(
	html: string,
	values: { patient: Parameters<typeof patientLine>[0] & { cin: string | null }; doctor: string; kind: CertificateKind; startsOn: string; endsOn: string },
) {
	const { patient, kind, startsOn, endsOn } = values;
	const filled: Record<Blank, string | null> = {
		patient: patientLine(patient),
		age: patient.birthDate ? `${differenceInYears(new Date(), parseISO(patient.birthDate))} ans` : null,
		cin: patient.cin,
		date: day(moroccoDay()),
		du: startsOn ? day(startsOn) : null,
		au: kind === "period" && endsOn ? day(endsOn) : startsOn ? day(startsOn) : null,
		jours: kind === "period" ? String(periodDays(startsOn, endsOn) ?? "") || null : "1",
		docteur: values.doctor,
	};
	return html.replace(/\{(\w+)\}/g, (all, name: string) => filled[name as Blank] ?? all);
}

/** Days of a period, both ends included; null when the dates don't make one. */
export function periodDays(startsOn: string, endsOn: string) {
	if (!startsOn || !endsOn) return null;
	const days = differenceInCalendarDays(parseISO(endsOn), parseISO(startsOn)) + 1;
	return days > 0 ? days : null;
}

/** The last day of a period of `days` days from `startsOn`. */
export const periodEnd = (startsOn: string, days: number) =>
	format(addDays(parseISO(startsOn), Math.max(1, days) - 1), "yyyy-MM-dd");
