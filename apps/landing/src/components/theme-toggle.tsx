"use client";

import { IconMoon, IconSun } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Light or dark, remembered on this device (the system setting until the visitor picks one). */
export function ThemeToggle({ className }: { className?: string }) {
	const toggle = () => {
		const root = document.documentElement;
		const next = root.dataset.theme === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		try {
			localStorage.setItem("theme", next);
		} catch {
			// Private mode: the choice lasts until the page is closed.
		}
	};

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label="Mode clair ou sombre"
			title="Mode clair ou sombre"
			className={cn("hover:bg-muted flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", className)}
		>
			{/* The icon follows <html data-theme>, so it is right from the first paint. */}
			<IconMoon className="size-[18px] dark:hidden" />
			<IconSun className="hidden size-[18px] dark:block" />
		</button>
	);
}
