"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A destination reachable with "G" then a letter; `name` is in nav.json. */
export type NavShortcut = { key: string; name: string; href: string };

/** Window event that opens the shortcuts sheet (from the command palette). */
export const SHORTCUTS_HELP_EVENT = "cabinova:shortcuts-help";

/** Second key of a "G …" sequence must come within this delay. */
const SEQUENCE_MS = 1200;

/** "⌘" on Apple devices, "Ctrl" elsewhere (decided after hydration). */
export function useModifierLabel() {
	const [label, setLabel] = useState("Ctrl");
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- navigator is browser-only
		if (/Mac|iPhone|iPad/.test(navigator.platform)) setLabel("⌘");
	}, []);
	return label;
}

/** Typing in a field, or a menu/dialog has the keyboard: shortcuts stay quiet. */
function busy(target: EventTarget | null) {
	const el = target as HTMLElement | null;
	return !!el?.closest?.("input, textarea, select, [contenteditable=true], [role=menu], [role=listbox]");
}

export function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] font-medium">
			{children}
		</kbd>
	);
}

/**
 * App-wide keyboard shortcuts: "G" then a letter to jump to a section, "?"
 * for the list of shortcuts. ⌘K and "/" belong to the command palette;
 * ⌘B / Ctrl+B (sidebar) to the sidebar itself. Never while typing.
 */
export function KeyboardShortcuts({ navigation }: { navigation: NavShortcut[] }) {
	const router = useRouter();
	const modifier = useModifierLabel();
	const [helpOpen, setHelpOpen] = useState(false);
	const [pendingG, setPendingG] = useState(false);
	const gAt = useRef(0);
	const t = useTranslations("common.shortcuts");
	const tn = useTranslations("nav.items");

	useEffect(() => {
		let clear: ReturnType<typeof setTimeout> | undefined;
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || busy(e.target)) return;
			if (document.querySelector("[role=dialog]")) return;

			if (e.key === "?") {
				e.preventDefault();
				setHelpOpen(true);
				return;
			}
			const key = e.key.toLowerCase();
			if (Date.now() - gAt.current < SEQUENCE_MS) {
				gAt.current = 0;
				setPendingG(false);
				const target = navigation.find((n) => n.key === key);
				if (target) {
					e.preventDefault();
					router.push(target.href);
				}
				return;
			}
			if (key === "g" && !e.shiftKey) {
				gAt.current = Date.now();
				setPendingG(true);
				clearTimeout(clear);
				clear = setTimeout(() => setPendingG(false), SEQUENCE_MS);
			}
		};
		const openHelp = () => setHelpOpen(true);
		document.addEventListener("keydown", onKey);
		window.addEventListener(SHORTCUTS_HELP_EVENT, openHelp);
		return () => {
			document.removeEventListener("keydown", onKey);
			window.removeEventListener(SHORTCUTS_HELP_EVENT, openHelp);
			clearTimeout(clear);
		};
	}, [navigation, router]);

	const groups: { title: string; rows: { keys: string[]; label: string }[] }[] = [
		{
			title: t("general"),
			rows: [
				{ keys: [modifier, "K"], label: t("openPalette") },
				{ keys: ["/"], label: t("search") },
				{ keys: [modifier, "B"], label: t("toggleSidebar") },
				{ keys: ["?"], label: t("show") },
				{ keys: ["Esc"], label: t("closeWindow") },
			],
		},
		{
			title: t("navigation"),
			rows: navigation.map((n) => ({ keys: ["G", n.key.toUpperCase()], label: tn(n.name) })),
		},
	];

	return (
		<>
			{/* "G" pressed: the next letter is a destination. */}
			<div
				aria-hidden
				className={`bg-popover text-popover-foreground pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-lg transition-opacity duration-150 ${pendingG ? "opacity-100" : "opacity-0"}`}
			>
				<Kbd>G</Kbd> {t("hint")} <span className="text-muted-foreground">{t("hintList")}</span>
			</div>

			<Dialog open={helpOpen} onOpenChange={setHelpOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("title")}</DialogTitle>
						<DialogDescription>{t("description")}</DialogDescription>
					</DialogHeader>
					<div className="grid gap-5">
						{groups
							.filter((g) => g.rows.length > 0)
							.map((group) => (
								<section key={group.title}>
									<h3 className="text-muted-foreground mb-2 text-xs font-medium">{group.title}</h3>
									<ul className="grid gap-1.5">
										{group.rows.map((row) => (
											<li key={row.label} className="flex items-center justify-between gap-4 text-sm">
												<span>{row.label}</span>
												<span className="flex shrink-0 items-center gap-1">
													{row.keys.map((k, i) => (
														<Fragment key={k}>
															{i > 0 && row.keys[0] === "G" && (
																<span className="text-muted-foreground text-xs">{t("then")}</span>
															)}
															<Kbd>{k}</Kbd>
														</Fragment>
													))}
												</span>
											</li>
										))}
									</ul>
								</section>
							))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
