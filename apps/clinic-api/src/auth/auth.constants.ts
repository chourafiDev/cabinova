/** Host-only cookie: each cabinet's subdomain has its own. */
export const SESSION_COOKIE = 'cabinova_clinic_session';

/** "Se souvenir de moi" checked: 30 days. Unchecked: browser session, 12h max. */
export const SESSION_TTL_REMEMBER = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_DEFAULT = 12 * 60 * 60 * 1000;
