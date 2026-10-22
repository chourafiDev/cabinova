// Types and labels of the audit log API (apps/api/src/audit).

export const AUDIT_ENTITIES = ["patient", "appointment", "consultation"] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const ENTITY_LABELS: Record<AuditEntity, string> = {
	patient: "Patient",
	appointment: "Rendez-vous",
	consultation: "Consultation",
};

/** One label per "entity.verb" action key written by the API. */
export const ACTION_LABELS: Record<string, string> = {
	"patient.create": "Patient créé",
	"patient.update": "Patient modifié",
	"patient.archive": "Patient archivé",
	"patient.restore": "Patient restauré",
	"patient.export": "Export CSV",
	"patient.delete": "Patient supprimé",
	"appointment.create": "Rendez-vous créé",
	"appointment.update": "Rendez-vous modifié",
	"appointment.move": "Rendez-vous déplacé",
	"appointment.status": "Statut du rendez-vous modifié",
	"consultation.view": "Consultation consultée",
	"consultation.create": "Consultation créée",
	"consultation.update": "Consultation modifiée",
	"consultation.complete": "Consultation clôturée",
	"medical_profile.view": "Antécédents consultés",
	"medical_profile.update": "Antécédents modifiés",
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;

export type AuditLogRow = {
	id: string;
	action: string;
	entity: AuditEntity;
	entityId: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	user: { id: string; name: string; email: string } | null;
};

export type AuditLogsPage = { data: AuditLogRow[]; total: number; pageCount: number };

/** "fields: city, coverage" / "count: 3" — field names and counts only, never medical values. */
export function formatMetadata(metadata: Record<string, unknown> | null) {
	if (!metadata || !Object.keys(metadata).length) return null;
	return Object.entries(metadata)
		.map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(", ") : String(value)}`)
		.join(" · ");
}
