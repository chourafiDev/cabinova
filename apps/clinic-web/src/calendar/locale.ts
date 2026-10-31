// Formatting and Monday-first weeks for the vendored big-calendar views.
import { addDays, format } from "date-fns";
import { arMA, fr } from "date-fns/locale";
import { useLocale } from "next-intl";
import { useMemo } from "react";

/** date-fns week options: weeks start on Monday (Morocco). */
export const WEEK = { weekStartsOn: 1 } as const;

/** date-fns `format` for the patterns with no words in them ("HH:mm", "yyyy-MM-dd"). */
export const fmt = (date: Date | number, pattern: string) => format(date, pattern, { locale: fr });

export type Fmt = typeof fmt;

/** date-fns `format` in the interface language, for month and day names. */
export function useFmt(): Fmt {
	const locale = useLocale() === "ar" ? arMA : fr;
	return useMemo(() => (date, pattern) => format(date, pattern, { locale }), [locale]);
}

const MONDAY = new Date(2024, 0, 1);

/** Monday → Sunday, in the interface language: "EEE" short, "EEEEE" one letter. */
export function useWeekDays(pattern: "EEE" | "EEEEE") {
	const fmt = useFmt();
	return Array.from({ length: 7 }, (_, i) => fmt(addDays(MONDAY, i), pattern));
}

/** Day index in a Monday-first week: lundi = 0 … dimanche = 6. */
export const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;
