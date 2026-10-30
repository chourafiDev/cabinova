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

/** A space as the owner manages it (GET /spaces/manage). */
export type ManagedSpace = Space & {
	active: boolean;
	patients: number;
	upcomingAppointments: number;
	members: number;
};

export type AgendaSettings = { defaultAppointmentMinutes: number };

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

export type SettingsSection = { href: string; label: string; hint: string; ownerOnly?: boolean };

export const SETTINGS_SECTIONS: SettingsSection[] = [
	{ href: "/settings/profile", label: "Mon profil", hint: "Nom, mot de passe, appareils" },
	{ href: "/settings/cabinet", label: "Cabinet", hint: "Nom, coordonnées", ownerOnly: true },
	{ href: "/settings/spaces", label: "Espaces", hint: "Sites du cabinet", ownerOnly: true },
	{ href: "/settings/hours", label: "Horaires & agenda", hint: "Ouverture, durée des RDV", ownerOnly: true },
	{ href: "/settings/tarifs", label: "Tarifs", hint: "Actes et honoraires", ownerOnly: true },
];

/** Days in the order a French week is read (Monday first), as OpeningHours keys. */
export const WEEK: { key: keyof OpeningHours; label: string; short: string }[] = [
	{ key: "1", label: "Lundi", short: "Lun" },
	{ key: "2", label: "Mardi", short: "Mar" },
	{ key: "3", label: "Mercredi", short: "Mer" },
	{ key: "4", label: "Jeudi", short: "Jeu" },
	{ key: "5", label: "Vendredi", short: "Ven" },
	{ key: "6", label: "Samedi", short: "Sam" },
	{ key: "0", label: "Dimanche", short: "Dim" },
];

/** "HH:MM" → minutes since midnight. */
export const toMinutes = (time: string) => {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
};

/** "9 h – 13 h, 15 h – 19 h", "8 h 30 – 12 h" or "Fermé". */
export function formatPeriods(periods: { from: string; to: string }[]) {
	if (!periods.length) return "Fermé";
	const time = (t: string) => {
		const [h, m] = t.split(":");
		return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
	};
	return periods.map((p) => `${time(p.from)} – ${time(p.to)}`).join(", ");
}

/** Problems the API would refuse, per day key, to show next to the day. */
export function openingHoursErrors(hours: OpeningHours) {
	const errors: Partial<Record<keyof OpeningHours, string>> = {};
	for (const { key } of WEEK) {
		const periods = [...hours[key]].sort((a, b) => a.from.localeCompare(b.from));
		if (periods.some((p) => !p.from || !p.to)) errors[key] = "Heure manquante.";
		else if (periods.some((p) => p.from >= p.to)) errors[key] = "Chaque plage doit finir après son début.";
		else if (periods.some((p, i) => i > 0 && p.from < periods[i - 1].to)) errors[key] = "Les plages se chevauchent.";
	}
	return errors;
}

/** "Chrome · macOS" from a user agent; good enough to recognise one's devices. */
export function describeDevice(userAgent: string | null) {
	if (!userAgent) return { label: "Appareil inconnu", mobile: false };
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
						: "Navigateur";
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
