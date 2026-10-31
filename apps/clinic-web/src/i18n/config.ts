export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Each language in its own script, whatever the interface language. */
export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", ar: "العربية" };

/** The language before sign-in, and on this device after sign-out. */
export const LOCALE_COOKIE = "cabinova_locale";

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);
export const directionOf = (locale: string) => (locale === "ar" ? "rtl" : "ltr");

/** Remembered a year; read by the server on the next request. */
export function rememberLocale(locale: Locale) {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
