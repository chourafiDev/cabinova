// The bell (admin-api src/notifications): saved per user, pushed live over SSE.

export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export type AppNotification = {
	id: string;
	kind: string;
	severity: NotificationSeverity;
	title: string;
	body: string | null;
	href: string | null;
	readAt: string | null;
	createdAt: string;
};

export type NotificationList = { data: AppNotification[]; unread: number };

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** "il y a 5 minutes", "hier"… */
export function timeAgo(iso: string, now: number) {
	const s = Math.round((new Date(iso).getTime() - now) / 1000);
	const abs = Math.abs(s);
	if (abs < 45) return "à l’instant";
	if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
	if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
	return rtf.format(Math.round(s / 86_400), "day");
}
