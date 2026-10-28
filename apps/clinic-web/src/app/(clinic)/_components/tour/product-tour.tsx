"use client";

import "driver.js/dist/driver.css";
import "./product-tour.css";
import { type DriveStep, driver } from "driver.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

/** URL that replays the tour (user menu "Revoir la visite"). */
export const TOUR_REPLAY_HREF = "/?visite=1";

/** Visible on this screen size (the sidebar is off-canvas on phones). */
const visible = (selector: string) => {
	const el = document.querySelector(selector);
	return !!el && el.getClientRects().length > 0;
};

function steps(firstName: string): DriveStep[] {
	const all: (DriveStep & { element?: string })[] = [
		{
			popover: {
				title: `Bienvenue, ${firstName} 👋`,
				description:
					"Voici l’espace de votre cabinet sur Cabinova. Une minute pour en faire le tour — vous pourrez la revoir depuis votre menu.",
			},
		},
		{
			element: '[data-tour="nav"]',
			popover: {
				title: "Votre cabinet, module par module",
				description:
					"Agenda, patients, consultations, ordonnances : tout se trouve ici. Les modules marqués « Bientôt » arrivent prochainement.",
				side: "right",
				align: "start",
			},
		},
		{
			element: '[data-tour="kpis"]',
			popover: {
				title: "Votre journée en un coup d’œil",
				description: "Rendez-vous du jour, patients vus, nouveaux patients et encaissements, comparés à la semaine dernière.",
				side: "bottom",
			},
		},
		{
			element: '[data-tour="appointments"]',
			popover: {
				title: "Rendez-vous et salle d’attente",
				description:
					"Suivez qui arrive, qui attend et qui est en consultation, en temps réel. Ouvrez l’agenda pour planifier.",
				side: "top",
			},
		},
		{
			element: '[data-tour="subscription"]',
			popover: {
				title: "Votre offre",
				description: "Votre période d’essai, les places de votre équipe et l’espace de stockage utilisé.",
				side: "top",
			},
		},
		{
			element: '[data-tour="account"]',
			popover: {
				title: "Votre compte",
				description:
					"Thème clair ou sombre, déconnexion, et « Revoir la visite ». Une question ? Le support Cabinova est en bas du menu.",
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
				steps: steps(firstName),
				popoverClass: "cabinova-tour",
				showProgress: true,
				progressText: "{{current}} / {{total}}",
				nextBtnText: "Suivant",
				prevBtnText: "Précédent",
				doneBtnText: "C’est parti",
				closeBtnLabel: "Passer la visite",
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
	}, [pathname, autoStart, replay, firstName, router]);

	return null;
}
