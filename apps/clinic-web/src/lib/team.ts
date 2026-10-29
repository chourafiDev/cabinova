// Types and helpers of Équipe (clinic-api src/team).

export type StaffRole = "doctor" | "secretary";

export type MemberStatus = "active" | "invited" | "expired" | "disabled";

/** A member of the cabinet's staff (GET /team). */
export type Member = {
	id: string;
	name: string;
	email: string;
	role: "owner" | StaffRole;
	roleLabel: string;
	status: MemberStatus;
	/** Invitation not accepted yet: when its link stops working. */
	inviteExpiresAt: string | null;
	lastLoginAt: string | null;
	createdAt: string;
	spaceIds: string[];
	/** Appointments to come with them as the doctor. */
	upcomingAppointments: number;
};

export type Quota = { used: number; max: number | null };

export type Team = {
	members: Member[];
	/** Active accounts against the offer; the owner counts as a doctor. */
	limits: { doctors: Quota; secretaries: Quota };
	/** Open spaces, to choose where each member works. */
	spaces: { id: string; name: string; city: string | null }[];
};

/** A link to give a member (POST /team, POST /team/:id/link). */
export type MemberLink = {
	url: string;
	expiresAt: string;
	/** "logged": no e-mail provider (development). */
	delivery: "sent" | "logged" | "failed";
	kind: "invitation" | "password";
};

export const ROLES: { value: StaffRole; label: string; description: string }[] = [
	{
		value: "doctor",
		label: "Médecin",
		description: "Agenda, patients et dossiers médicaux (antécédents). Peut recevoir des rendez-vous.",
	},
	{
		value: "secretary",
		label: "Secrétaire",
		description: "Agenda et dossiers administratifs des patients, sans accès aux antécédents.",
	},
];

export const STATUS_LABELS: Record<MemberStatus, string> = {
	active: "Actif",
	invited: "Invitation envoyée",
	expired: "Invitation expirée",
	disabled: "Désactivé",
};

/** The quota a role uses. */
export const quotaOf = (team: Team, role: StaffRole) =>
	role === "doctor" ? team.limits.doctors : team.limits.secretaries;

export const isFull = ({ used, max }: Quota) => max !== null && used >= max;
