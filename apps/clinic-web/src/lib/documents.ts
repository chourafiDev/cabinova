// Types and helpers of the patient documents API (clinic-api/src/documents).

export const DOCUMENT_CATEGORIES = ["lab", "imaging", "prescription", "report", "administrative", "other"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** GET /patients/:id/documents — newest first. */
export type PatientDocument = {
	id: string;
	category: DocumentCategory;
	name: string;
	contentType: string;
	size: number;
	createdAt: string;
	uploadedById: string | null;
	uploadedBy: string | null;
};

export const documentsKey = (patientId: string) => ["documents", patientId];

/** What the API keeps (it checks the bytes too); also the file picker's filter. */
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const documentUrl = (patientId: string, id: string, download = false) =>
	`/api/patients/${patientId}/documents/${id}/file${download ? "?download=1" : ""}`;

/** "245 Ko", "3,4 Mo" (useFormat().size). */
export function formatSize(bytes: number, locale: string) {
	const [kb, mb] = locale.startsWith("ar") ? ["ك.ب", "م.ب"] : ["Ko", "Mo"];
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} ${kb}`;
	return `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} ${mb}`;
}
