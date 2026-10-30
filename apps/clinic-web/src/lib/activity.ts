// Journal d'activité (clinic-api GET /activity).
import { STATUS_LABELS, type AppointmentStatus } from "./appointments";

export type ActivityEntry = {
	id: string;
	userId: string | null;
	actorName: string | null;
	action: string;
	target: string | null;
	detail: string | null;
	ip: string | null;
	createdAt: string;
};

export type ActivityPage = {
	data: ActivityEntry[];
	total: number;
	pageCount: number;
	people: { id: string; name: string }[];
};

export const ACTIVITY_CATEGORIES = [
	{ key: "patients", label: "Patients" },
	{ key: "appointments", label: "Rendez-vous" },
	{ key: "payments", label: "Encaissements" },
	{ key: "team", label: "Équipe" },
	{ key: "security", label: "Sécurité" },
	{ key: "settings", label: "Paramètres" },
] as const;

/** Reads after the person's name: "Salma a modifié le dossier de ALAOUI Omar". */
const ACTIONS: Record<string, string> = {
	"patient.view": "a consulté le dossier de",
	"patient.create": "a créé le dossier de",
	"patient.update": "a modifié le dossier de",
	"patient.archive": "a archivé le dossier de",
	"patient.restore": "a restauré le dossier de",
	"patient.medical_update": "a modifié le profil médical de",
	"appointment.create": "a pris un rendez-vous pour",
	"appointment.update": "a modifié le rendez-vous de",
	"appointment.status": "a changé le statut du rendez-vous de",
	"payment.checkout": "a encaissé la visite de",
	"payment.cancel": "a annulé un paiement de",
	"payment.refund": "a remboursé",
	"cashier.close": "a clôturé la caisse",
	"act.create": "a ajouté l’acte",
	"act.update": "a modifié l’acte",
	"act.archive": "a archivé l’acte",
	"act.restore": "a restauré l’acte",
	"team.invite": "a invité",
	"team.joined": "a rejoint l’équipe",
	"team.update": "a modifié le rôle ou les espaces de",
	"team.link": "a envoyé un lien de mot de passe à",
	"team.two_factor_reset": "a réinitialisé la double authentification de",
	"team.two_factor_required": "a changé l’obligation de double authentification",
	"team.deactivate": "a désactivé",
	"team.reactivate": "a réactivé",
	"team.delete": "a supprimé l’invitation de",
	"space.create": "a créé l’espace",
	"space.update": "a modifié l’espace",
	"space.hours": "a modifié les horaires de",
	"space.close": "a fermé l’espace",
	"space.reopen": "a rouvert l’espace",
	"settings.cabinet": "a modifié les informations du cabinet",
	"settings.agenda": "a modifié les réglages de l’agenda",
	"auth.login": "s’est connecté(e)",
	"auth.password_change": "a changé son mot de passe",
	"auth.password_reset": "a réinitialisé son mot de passe",
	"auth.two_factor_enable": "a activé la double authentification",
	"auth.two_factor_disable": "a désactivé la double authentification",
};

export const activityVerb = (action: string) => ACTIONS[action] ?? action;

/** A failed sign-in has no person: the address tried is the subject. */
export const isFailedLogin = (action: string) => action === "auth.login_failed";

export function activityDetail({ action, detail }: ActivityEntry) {
	if (!detail) return null;
	if (action === "appointment.status") return STATUS_LABELS[detail as AppointmentStatus] ?? detail;
	if (action === "team.two_factor_required") return detail === "true" ? "Obligatoire" : "Facultative";
	return detail;
}
