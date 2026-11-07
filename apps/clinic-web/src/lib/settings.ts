// Types and helpers of Paramètres (clinic-api src/settings and spaces).
import type { OpeningHours, Space } from "./session";

export type { OpeningHours };

/** The cabinet's identity, shared with Super Admin (GET /settings/cabinet). */
export type CabinetIdentity = {
	name: string;
	legalName: string | null;
	specialty: string | null;
	address: string | null;
	city: string | null;
	phone: string | null;
	email: string;
	subdomain: string;
};

/** A signed-in device (GET /settings/sessions). */
export type DeviceSession = {
	id: string;
	userAgent: string | null;
	ip: string | null;
	createdAt: string;
	expiresAt: string;
	current: boolean;
};

/** A device of the team (GET /team/sessions). */
export type TeamSession = DeviceSession & {
	lastSeenAt: string;
	member: { id: string; name: string; role: string };
};

/** A space as the owner manages it (GET /spaces/manage). */
export type ManagedSpace = Space & {
	active: boolean;
	patients: number;
	upcomingAppointments: number;
	members: number;
};

/** Paramètres › Horaires & agenda: the booking default, and the public holidays the cabinet works (keys). */
export type AgendaSettings = { defaultAppointmentMinutes: number; openHolidays: string[] };

/** Same as migration 0006: Mon–Fri 08–18, Sat 08–13. */
export const DEFAULT_OPENING_HOURS: OpeningHours = {
	"0": [],
	"1": [{ from: "08:00", to: "18:00" }],
	"2": [{ from: "08:00", to: "18:00" }],
	"3": [{ from: "08:00", to: "18:00" }],
	"4": [{ from: "08:00", to: "18:00" }],
	"5": [{ from: "08:00", to: "18:00" }],
	"6": [{ from: "08:00", to: "13:00" }],
};

export type SettingsSection = { href: string; key: "profile" | "cabinet" | "spaces" | "hours" | "tarifs" | "sessions" | "activity" | "integrations"; ownerOnly?: boolean };

export const SETTINGS_SECTIONS: SettingsSection[] = [
	{ href: "/settings/profile", key: "profile" },
	{ href: "/settings/cabinet", key: "cabinet", ownerOnly: true },
	{ href: "/settings/spaces", key: "spaces", ownerOnly: true },
	{ href: "/settings/hours", key: "hours", ownerOnly: true },
	{ href: "/settings/tarifs", key: "tarifs", ownerOnly: true },
	{ href: "/settings/integrations", key: "integrations", ownerOnly: true },
	{ href: "/settings/sessions", key: "sessions", ownerOnly: true },
	{ href: "/settings/activity", key: "activity", ownerOnly: true },
];

/** Days in the order a French week is read (Monday first), as OpeningHours keys. */
export const WEEK: (keyof OpeningHours)[] = ["1", "2", "3", "4", "5", "6", "0"];

/** "HH:MM" → minutes since midnight. */
export const toMinutes = (time: string) => {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
};

/** "9 h – 13 h, 15 h – 19 h", "8 h 30 – 12 h" or "Fermé". */
export function formatPeriods(periods: { from: string; to: string }[], locale = "fr-MA") {
	const arabic = locale.startsWith("ar");
	if (!periods.length) return arabic ? "مغلق" : "Fermé";
	const time = (t: string) => {
		if (arabic) return t;
		const [h, m] = t.split(":");
		return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
	};
	return periods.map((p) => `${time(p.from)} – ${time(p.to)}`).join(", ");
}

/** Problems the API would refuse, per day key, to show next to the day. */
export function openingHoursErrors(hours: OpeningHours) {
	const errors: Partial<Record<keyof OpeningHours, "missing" | "order" | "overlap">> = {};
	for (const key of WEEK) {
		const periods = [...hours[key]].sort((a, b) => a.from.localeCompare(b.from));
		if (periods.some((p) => !p.from || !p.to)) errors[key] = "missing";
		else if (periods.some((p) => p.from >= p.to)) errors[key] = "order";
		else if (periods.some((p, i) => i > 0 && p.from < periods[i - 1].to)) errors[key] = "overlap";
	}
	return errors;
}

/** "Chrome · macOS" from a user agent; good enough to recognise one's devices. */
export function describeDevice(userAgent: string | null, names: { unknown: string; browser: string }) {
	if (!userAgent) return { label: names.unknown, mobile: false };
	const browser = /Edg\//.test(userAgent)
		? "Edge"
		: /OPR\//.test(userAgent)
			? "Opera"
			: /Firefox\//.test(userAgent)
				? "Firefox"
				: /Chrome\//.test(userAgent)
					? "Chrome"
					: /Safari\//.test(userAgent)
						? "Safari"
						: names.browser;
	const os = /iPhone|iPad/.test(userAgent)
		? "iOS"
		: /Android/.test(userAgent)
			? "Android"
			: /Mac OS X/.test(userAgent)
				? "macOS"
				: /Windows/.test(userAgent)
					? "Windows"
					: /Linux/.test(userAgent)
						? "Linux"
						: null;
	const mobile = /Mobile|iPhone|Android/.test(userAgent);
	return { label: os ? `${browser} · ${os}` : browser, mobile };
}

/** GET /auth/2fa */
export type TwoFactorStatus = {
	enabled: boolean;
	enabledAt: string | null;
	recoveryCodesLeft: number;
	/** The cabinet requires it: it can't be turned off. */
	required: boolean;
};
