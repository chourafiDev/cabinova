"use client";

import "driver.js/dist/driver.css";
import "./product-tour.css";
import { type DriveStep, driver } from "driver.js";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { directionOf } from "@/i18n/config";
import { api } from "@/lib/api-client";

/** URL that replays the tour (user menu "Revoir la visite"). */
export const TOUR_REPLAY_HREF = "/?visite=1";

/** Visible on this screen size (the sidebar is off-canvas on phones). */
const visible = (selector: string) => {
	const el = document.querySelector(selector);
	return !!el && el.getClientRects().length > 0;
};

function steps(firstName: string, t: (key: string, values?: Record<string, string>) => string, rtl: boolean): DriveStep[] {
	const all: (DriveStep & { element?: string })[] = [
		{
			popover: {
				title: t("welcomeTitle", { name: firstName }),
				description: t("welcome"),
			},
		},
		{
			element: '[data-tour="nav"]',
			popover: {
				title: t("navTitle"),
				description: t("nav"),
				side: rtl ? "left" : "right",
				align: "start",
			},
		},
		{
			element: '[data-tour="kpis"]',
			popover: {
				title: t("kpisTitle"),
				description: t("kpis"),
				side: "bottom",
			},
		},
		{
			element: '[data-tour="appointments"]',
			popover: {
				title: t("appointmentsTitle"),
				description: t("appointments"),
				side: "top",
			},
		},
		{
			element: '[data-tour="subscription"]',
			popover: {
				title: t("subscriptionTitle"),
				description: t("subscription"),
				side: "top",
			},
		},
		{
			element: '[data-tour="account"]',
			popover: {
				title: t("accountTitle"),
				description: t("account"),
				side: "bottom",
				align: "end",
			},
		},
	];
	return all.filter((s) => !s.element || visible(s.element));
}

/**
 * First-sign-in product tour of the dashboard (driver.js). Starts once per
 * account — finishing or skipping it is saved by clinic-api — and again on
 * demand from the user menu (?visite=1).
 */
export function ProductTour({ autoStart, firstName }: { autoStart: boolean; firstName: string }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const started = useRef(false);
	const t = useTranslations("tour");
	const rtl = directionOf(useLocale()) === "rtl";
	const replay = searchParams.get("visite") === "1";

	useEffect(() => {
		if (pathname !== "/" || started.current || !(autoStart || replay)) return;

		// Let the dashboard settle (charts, fonts) before measuring targets.
		// The guard is set when the tour really starts: React runs effects
		// twice in development, and the first timer is cleared.
		const timer = setTimeout(() => {
			if (started.current) return;
			started.current = true;
			if (replay) router.replace("/", { scroll: false });
			const tour = driver({
				steps: steps(firstName, t as never, rtl),
				popoverClass: "cabinova-tour",
				showProgress: true,
				progressText: "{{current}} / {{total}}",
				nextBtnText: t("next"),
				prevBtnText: t("prev"),
				doneBtnText: t("done"),
				closeBtnLabel: t("skip"),
				stagePadding: 6,
				stageRadius: 12,
				overlayOpacity: 0.55,
				smoothScroll: true,
				onDestroyed: () => {
					// Finished or skipped: don't start it again on sign-in.
					void api("/onboarding/tour", { method: "POST" }).catch(() => {});
				},
			});
			tour.drive();
		}, 600);
		return () => clearTimeout(timer);
	}, [pathname, autoStart, replay, firstName, router, t, rtl]);

	return null;
}
