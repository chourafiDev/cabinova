"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	type AppIcon,
	IconCompass,
	IconKeyboard,
	IconLocation,
	IconLogout,
	IconMonitor,
	IconMoon,
	IconSearch,
	IconSun,
	IconSupport,
} from "@/components/icons";
import { Kbd, SHORTCUTS_HELP_EVENT, useModifierLabel } from "@/components/keyboard-shortcuts";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";
import { api } from "@/lib/api-client";
import type { ClinicSession } from "@/lib/session";
import { spaceLabel, switchSpace } from "@/lib/spaces";
import { allNavItems, visibleNavItems } from "./nav";
import { TOUR_REPLAY_HREF } from "./tour/product-tour";

type Action = { id: string; label: string; icon: AppIcon; keywords?: string; run: () => void };

/** Accent- and case-insensitive: "parametres" finds "Paramètres". */
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

/**
 * Command palette of the clinic app (⌘K / Ctrl+K or "/"): jump to a page
 * or run an action — theme, product tour, shortcuts, support, sign out.
 * Patient and appointment search join it with the agenda and patients.
 */
export function CommandPalette({ spaces, role }: { spaces: ClinicSession["spaces"]; role: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const { setTheme } = useTheme();
	const modifier = useModifierLabel();
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const t = useTranslations("common.palette");
	const tn = useTranslations("nav.items");
	const tc = useTranslations("common");

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((o) => !o);
				return;
			}
			const target = e.target as HTMLElement | null;
			const typing = target?.closest("input, textarea, select, [contenteditable=true]");
			if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				setOpen(true);
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	function go(href: string) {
		setOpen(false);
		router.push(href);
	}
	function pick(run: () => void) {
		setOpen(false);
		run();
	}
	async function signOut() {
		await api("/auth/logout", { method: "POST" }).catch(() => {});
		router.replace("/login");
		router.refresh();
	}

	const spaceActions: Action[] = (spaces?.spaces ?? [])
		.filter((s) => s.id !== spaces?.current.id)
		.map((s) => ({
			id: `space-${s.id}`,
			label: t("goToSpace", { space: spaceLabel(s) }),
			icon: IconLocation,
			keywords: "changer espace site succursale",
			run: () =>
				pick(async () => {
					const href = await switchSpace(s.id, pathname);
					router.push(href);
					router.refresh();
				}),
		}));
	const actions: Action[] = [
		...spaceActions,
		{ id: "tour", label: t("tour"), icon: IconCompass, keywords: "aide découvrir tutoriel", run: () => go(TOUR_REPLAY_HREF) },
		{ id: "theme-light", label: t("themeLight"), icon: IconSun, keywords: "apparence mode jour", run: () => pick(() => setTheme("light")) },
		{ id: "theme-dark", label: t("themeDark"), icon: IconMoon, keywords: "apparence mode nuit dark", run: () => pick(() => setTheme("dark")) },
		{ id: "theme-system", label: t("themeSystem"), icon: IconMonitor, keywords: "apparence automatique", run: () => pick(() => setTheme("system")) },
		{ id: "shortcuts", label: t("shortcuts"), icon: IconKeyboard, keywords: "aide touches clavier", run: () => pick(() => window.dispatchEvent(new Event(SHORTCUTS_HELP_EVENT))) },
		{ id: "support", label: tc("support"), icon: IconSupport, keywords: "aide question problème", run: () => pick(() => (window.location.href = "mailto:support@cabinova.ma")) },
		{ id: "sign-out", label: t("signOut"), icon: IconLogout, keywords: "déconnexion quitter", run: () => pick(signOut) },
	];
	const term = fold(input.trim());
	const pages = visibleNavItems(allNavItems, role).filter((item) => !term || fold(tn(item.key)).includes(term));
	const visibleActions = actions.filter((a) => !term || fold(`${a.label} ${a.keywords ?? ""}`).includes(term));

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="text-muted-foreground hover:bg-gray/5 flex h-9 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm transition-colors sm:w-60"
				aria-label={t("open")}
			>
				<IconSearch className="size-4 shrink-0" />
				<span className="hidden flex-1 text-start sm:inline">{t("trigger")}</span>
				<kbd className="bg-muted pointer-events-none hidden h-5 items-center rounded px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
					{modifier} K
				</kbd>
			</button>

			<CommandDialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setInput("");
				}}
				title={t("title")}
				description={t("description")}
				className="sm:max-w-lg"
			>
				<Command shouldFilter={false}>
					<CommandInput value={input} onValueChange={setInput} placeholder={t("placeholder")}/>
					<CommandList className="max-h-[min(60vh,420px)]">
						<CommandEmpty>{t("empty", { term: input.trim() })}</CommandEmpty>
						{pages.length > 0 && (
							<CommandGroup heading={t("pages")}>
								{pages.map((item) => (
									<CommandItem key={item.href} value={`page-${item.href}`} onSelect={() => go(item.href)}>
										<item.icon className="text-muted-foreground" />
										{tn(item.key)}
										{item.shortcut && (
											<CommandShortcut className="flex gap-1">
												<Kbd>G</Kbd>
												<Kbd>{item.shortcut.toUpperCase()}</Kbd>
											</CommandShortcut>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{visibleActions.length > 0 && (
							<CommandGroup heading={t("actions")}>
								{visibleActions.map((a) => (
									<CommandItem key={a.id} value={`action-${a.id}`} onSelect={a.run}>
										<a.icon className="text-muted-foreground" />
										{a.label}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
					<div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-[11px]">
						<span>
							<kbd className="font-mono">↑↓</kbd> {t("navigate")}
						</span>
						<span>
							<kbd className="font-mono">↵</kbd> {t("select")}
						</span>
						<span>
							<kbd className="font-mono">{t("escape")}</kbd> {t("dismiss")}
						</span>
					</div>
				</Command>
			</CommandDialog>
		</>
	);
}
