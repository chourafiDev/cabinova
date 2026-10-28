"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Gives up after this long (a navigation that failed or was cancelled). */
const MAX_MS = 15_000;

/**
 * Thin bar at the top of the window while the next page loads: starts on a
 * click on an internal link (or browser back/forward), creeps towards 90 %,
 * and completes when the URL has changed. Styled directly on the element,
 * so the page never re-renders for it.
 */
export function NavigationProgress() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const bar = useRef<HTMLDivElement>(null);
	const progress = useRef(0);
	const trickle = useRef<number | undefined>(undefined);
	const giveUp = useRef<number | undefined>(undefined);
	const hide = useRef<number | undefined>(undefined);

	useEffect(() => {
		const paint = (value: number, visible: boolean) => {
			progress.current = value;
			if (!bar.current) return;
			bar.current.style.transform = `scaleX(${value})`;
			bar.current.style.opacity = visible ? "1" : "0";
		};
		const stopTimers = () => {
			window.clearInterval(trickle.current);
			window.clearTimeout(giveUp.current);
			window.clearTimeout(hide.current);
		};
		const start = () => {
			stopTimers();
			paint(0.08, true);
			trickle.current = window.setInterval(() => paint(progress.current + (0.9 - progress.current) * 0.08, true), 200);
			giveUp.current = window.setTimeout(() => window.dispatchEvent(new Event("navigation-progress:done")), MAX_MS);
		};
		const done = () => {
			stopTimers();
			if (progress.current === 0) return;
			paint(1, true);
			// Fade out at full width, then reset out of sight.
			hide.current = window.setTimeout(() => {
				if (bar.current) bar.current.style.opacity = "0";
				hide.current = window.setTimeout(() => paint(0, false), 200);
			}, 250);
		};

		const onClick = (e: MouseEvent) => {
			if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			const link = (e.target as Element | null)?.closest?.("a");
			if (!link || !link.href || link.target === "_blank" || link.hasAttribute("download")) return;
			const url = new URL(link.href, window.location.href);
			if (url.origin !== window.location.origin) return;
			// Same page (or only the #hash changes): nothing will load.
			if (url.pathname === window.location.pathname && url.search === window.location.search) return;
			start();
		};

		document.addEventListener("click", onClick, true);
		window.addEventListener("popstate", start);
		window.addEventListener("navigation-progress:done", done);
		return () => {
			document.removeEventListener("click", onClick, true);
			window.removeEventListener("popstate", start);
			window.removeEventListener("navigation-progress:done", done);
			stopTimers();
		};
	}, []);

	// The new page is on screen.
	useEffect(() => {
		window.dispatchEvent(new Event("navigation-progress:done"));
	}, [pathname, searchParams]);

	return (
		<div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
			<div
				ref={bar}
				className="h-full origin-left bg-primary opacity-0 shadow-[0_0_8px_var(--primary)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
				style={{ transform: "scaleX(0)" }}
			/>
		</div>
	);
}
