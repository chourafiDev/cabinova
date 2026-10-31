export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Each language in its own script, whatever the interface language. */
export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", ar: "العربية" };

/** The language before sign-in, and on this device after sign-out. */
export const LOCALE_COOKIE = "cabinova_locale";

/** For Intl: Moroccan French, or Arabic with Western digits. */
export const intlLocale = (locale: string) => (locale === "ar" ? "ar-MA-u-nu-latn" : "fr-MA");

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);
export const directionOf = (locale: string) => (locale === "ar" ? "rtl" : "ltr");

/** Remembered a year; read by the server on the next request. */
export function rememberLocale(locale: Locale) {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * After signing in: a language picked on the sign-in pages becomes the
 * account's, unless the account already has one. Never blocks the sign-in.
 */
export async function adoptLocale(save: (locale: Locale) => Promise<unknown>) {
	const value = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`))?.[1];
	if (isLocale(value)) await save(value).catch(() => undefined);
}
