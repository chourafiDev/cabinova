// Journal d'activité (clinic-api GET /activity).

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

export const ACTIVITY_CATEGORIES = ["patients", "appointments", "payments", "team", "security", "settings"] as const;

/** Message key of an action: "patient.view" → "patient_view". */
export const actionKey = (action: string) => action.replaceAll(".", "_");

/** A failed sign-in has no person: the address tried is the subject. */
export const isFailedLogin = (action: string) => action === "auth.login_failed";
