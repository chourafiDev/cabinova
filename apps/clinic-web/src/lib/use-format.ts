import { formatDistanceToNowStrict } from "date-fns";
import { arMA, fr } from "date-fns/locale";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { intlLocale } from "@/i18n/config";
import { durationLabel } from "./appointments";
import { formatSize } from "./documents";
import { clock } from "./dashboard";
import { formatDate } from "./format";
import { mad } from "./payments";
import { bucketLabel, bucketTitle, type Bucket, formatRate, periodLabel, weekdays } from "./reports";
import { formatPeriods } from "./settings";

export const formatterFor = (locale: string) => ({
	date: (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => formatDate(date, opts, locale),
	mad: (centimes: number) => mad(centimes, locale),
	clock: (iso: string) => clock(iso, locale),
	number: (value: number) => value.toLocaleString(locale),
	size: (bytes: number) => formatSize(bytes, locale),
	bucketLabel: (date: string, bucket: Bucket) => bucketLabel(date, bucket, locale),
	bucketTitle: (date: string, bucket: Bucket) => bucketTitle(date, bucket, locale),
	period: (from: string, to: string) => periodLabel(from, to, locale),
	rate: (rate: number | null) => formatRate(rate, locale),
	weekdays: (width: "short" | "long") => weekdays(locale, width),
	ago: (date: string) =>
		formatDistanceToNowStrict(new Date(date), { locale: locale.startsWith("ar") ? arMA : fr, addSuffix: true }),
	duration: (minutes: number) => durationLabel(minutes, locale),
	periods: (periods: { from: string; to: string }[]) => formatPeriods(periods, locale),
});

/** Dates and amounts in the interface language. */
export function useFormat() {
	const locale = intlLocale(useLocale());
	return useMemo(() => formatterFor(locale), [locale]);
}
