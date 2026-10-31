import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { getClinicState } from "@/lib/session";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

/**
 * No language in the URL: a signed-in person's own choice, else the cookie
 * of the sign-in pages, else French.
 */
export default getRequestConfig(async () => {
	const state = await getClinicState().catch(() => null);
	const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
	const chosen = state?.status === "signed-in" ? state.session.user.locale : cookie;
	const locale = isLocale(chosen) ? chosen : DEFAULT_LOCALE;
	return {
		locale,
		messages: { common: (await import(`../../messages/${locale}/common.json`)).default },
	};
});
