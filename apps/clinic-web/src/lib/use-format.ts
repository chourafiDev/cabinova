"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { intlLocale } from "@/i18n/config";
import { formatDate, formatMad } from "./format";

/** Dates and amounts in the interface language. */
export function useFormat() {
	const locale = intlLocale(useLocale());
	return useMemo(
		() => ({
			date: (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => formatDate(date, opts, locale),
			mad: (centimes: number) => formatMad(centimes, locale),
		}),
		[locale],
	);
}
