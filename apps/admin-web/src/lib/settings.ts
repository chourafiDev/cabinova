// Configuration globale — shapes returned by GET /settings (admin-api
// src/settings). Paiements live in lib/billing.ts (/billing/settings).

export type Branding = { platformName: string; primaryColor: string; logoUrl: string | null };

export type Language = "fr" | "ar" | "en";
export const LANGUAGE_LABELS: Record<Language, string> = { fr: "Français", ar: "العربية — Arabe", en: "English — Anglais" };

export const TIMEZONES = [
	{ value: "Africa/Casablanca", label: "Maroc — Casablanca" },
	{ value: "Europe/Paris", label: "France — Paris" },
	{ value: "Africa/Algiers", label: "Algérie — Alger" },
	{ value: "Africa/Tunis", label: "Tunisie — Tunis" },
	{ value: "Africa/Dakar", label: "Sénégal — Dakar" },
	{ value: "Africa/Abidjan", label: "Côte d’Ivoire — Abidjan" },
] as const;

export type PlatformSettings = {
	general: {
		platformName: string;
		supportEmail: string | null;
		supportPhone: string | null;
		websiteUrl: string | null;
		defaultTimezone: string;
	};
	email: { senderName: string; senderAddress: string | null; replyTo: string | null; signature: string | null };
	notifications: {
		cabinets: { trialEnding: boolean; invoiceIssued: boolean; invoiceOverdue: boolean; paymentReceipt: boolean };
		team: { recipients: string[]; incidents: boolean; databaseUnreachable: boolean; invoiceOverdue: boolean };
	};
	languages: { defaultLanguage: Language; available: Language[] };
	branding: { primaryColor: string; logoUrl: string | null };
	updatedAt: Partial<Record<"general" | "email" | "notifications" | "languages" | "branding", string>>;
	delivery: { provider: string | null; defaultFrom: string };
};

export const SECTIONS = [
	{ key: "general", label: "Général", hint: "Nom, contact, fuseau horaire" },
	{ key: "branding", label: "Identité visuelle", hint: "Logo et couleur" },
	{ key: "email", label: "E-mails", hint: "Expéditeur, réponses, signature" },
	{ key: "notifications", label: "Notifications", hint: "Cabinets et équipe" },
	{ key: "payments", label: "Paiements", hint: "RIB et délais" },
	{ key: "languages", label: "Langues", hint: "Langue des cabinets" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];
