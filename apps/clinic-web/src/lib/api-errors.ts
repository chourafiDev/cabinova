import ar from "../../messages/ar/errors.json";

const ARABIC: Record<string, string> = ar;

type ErrorBody = {
	status?: number;
	code?: string;
	/** Set when one code covers several situations. */
	key?: string;
	params?: Record<string, string | number | null>;
	message?: string | string[];
};

/** Validation errors have no code; a 429 comes from the rate limiter. */
const fallbackKey = ({ status }: ErrorBody) => (status === 429 ? "RATE_LIMITED" : status === 400 ? "VALIDATION" : "UNKNOWN");
const RATE_LIMITED = "Trop de tentatives. Patientez une minute puis réessayez.";

/** The API speaks French; Arabic comes from messages/ar/errors.json, by code. */
export function translateError(error: ErrorBody, locale: string) {
	const french = error.status === 429 ? RATE_LIMITED : [error.message].flat()[0] || "Une erreur est survenue.";
	if (locale !== "ar") return french;
	const text = ARABIC[error.key ?? error.code ?? fallbackKey(error)] ?? ARABIC.UNKNOWN;
	return text.replace(/\{(\w+)\}/g, (_, name) => String(error.params?.[name] ?? ""));
}
