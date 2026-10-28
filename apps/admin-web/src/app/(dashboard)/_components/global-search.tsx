"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Kbd, SHORTCUTS_HELP_EVENT, useModifierLabel } from "@/components/keyboard-shortcuts";
import type { IconType } from "react-icons";
import { HiBuildingOffice2, HiLifebuoy, HiReceiptPercent, HiUser } from "react-icons/hi2";
import { LuFileText, LuKeyboard, LuLoader, LuLogOut, LuMonitor, LuMoon, LuPlus, LuSearch, LuSettings2, LuShieldCheck, LuSun } from "react-icons/lu";
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
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/billing";
import { can, type Permission } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { STATUS_LABELS as TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/support";
import { STATUS_LABELS as TENANT_STATUS_LABELS, type TenantStatus } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { allNavItems } from "./nav";

/** GET /search — only the groups the user may open are present. */
type SearchResults = {
	tenants?: { id: string; name: string; subdomain: string | null; city: string | null; status: TenantStatus }[];
	invoices?: { id: string; number: string; amount: number; status: InvoiceStatus; tenantName: string }[];
	tickets?: { id: string; number: string; subject: string; status: TicketStatus; tenantName: string | null }[];
	users?: { id: string; name: string; email: string; active: boolean }[];
	promoCodes?: { id: string; code: string; discountPercent: number; active: boolean }[];
};

type Result = { key: string; href: string; icon: IconType; title: string; subtitle?: string | null; meta?: string };

const MIN_LENGTH = 2;

/** Accent- and case-insensitive, like the API: "fact" finds "Facturation". */
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

function toGroups(data: SearchResults | undefined): { heading: string; items: Result[] }[] {
	if (!data) return [];
	return [
		{
			heading: "Cabinets",
			items: (data.tenants ?? []).map((t) => ({
				key: `tenant-${t.id}`,
				href: `/tenants/${t.id}`,
				icon: HiBuildingOffice2,
				title: t.name,
				subtitle: [t.subdomain && `${t.subdomain}.cabinova.ma`, t.city].filter(Boolean).join(" · "),
				meta: TENANT_STATUS_LABELS[t.status],
			})),
		},
		{
			heading: "Factures",
			items: (data.invoices ?? []).map((i) => ({
				key: `invoice-${i.id}`,
				href: `/billing?${new URLSearchParams({ status: "all", search: i.number })}`,
				icon: LuFileText,
				title: i.number,
				subtitle: `${i.tenantName} · ${formatPrice(i.amount)}`,
				meta: INVOICE_STATUS_LABELS[i.status],
			})),
		},
		{
			heading: "Tickets",
			items: (data.tickets ?? []).map((t) => ({
				key: `ticket-${t.id}`,
				href: `/support/${t.id}`,
				icon: HiLifebuoy,
				title: t.subject,
				subtitle: [t.number, t.tenantName].filter(Boolean).join(" · "),
				meta: TICKET_STATUS_LABELS[t.status],
			})),
		},
		{
			heading: "Utilisateurs",
			items: (data.users ?? []).map((u) => ({
				key: `user-${u.id}`,
				href: `/users/${u.id}`,
				icon: HiUser,
				title: u.name,
				subtitle: u.email,
				meta: u.active ? undefined : "Désactivé",
			})),
		},
		{
			heading: "Codes promo",
			items: (data.promoCodes ?? []).map((p) => ({
				key: `promo-${p.id}`,
				href: "/plans/promo-codes",
				icon: HiReceiptPercent,
				title: p.code,
				subtitle: `−${p.discountPercent} %`,
				meta: p.active ? undefined : "Inactif",
			})),
		},
	].filter((g) => g.items.length > 0);
}

/** A command of the palette; shown only with its permission. */
type Action = {
	id: string;
	label: string;
	icon: IconType;
	keywords?: string;
	permission?: Permission;
	run: () => void;
};

/**
 * Command palette and header search (⌘K / Ctrl+K or "/"): actions (create,
 * theme, shortcuts, sign out), pages to jump to, then cabinets, invoices,
 * tickets, users and promo codes from the API — only what the user may
 * open or do.
 */
export function GlobalSearch() {
	const router = useRouter();
	const permissions = useSessionStore((s) => s.session?.user.permissions);
	const modifier = useModifierLabel();
	const { setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const [term, setTerm] = useState("");

	// Shortcuts: ⌘K / Ctrl+K anywhere, "/" when not typing in a field.
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

	// Ask the API once typing pauses.
	useEffect(() => {
		const timer = setTimeout(() => setTerm(input.trim()), 200);
		return () => clearTimeout(timer);
	}, [input]);

	const searching = term.length >= MIN_LENGTH;
	const { data, isFetching } = useQuery({
		queryKey: ["global-search", term],
		queryFn: ({ signal }) => api<SearchResults>(`/search?${new URLSearchParams({ q: term })}`, { signal }),
		enabled: open && searching,
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});

	const actions: Action[] = [
		{ id: "new-tenant", label: "Nouveau cabinet", icon: LuPlus, keywords: "créer ajouter clinique", permission: "tenants:write", run: () => go("/tenants/new") },
		{ id: "new-ticket", label: "Nouveau ticket", icon: LuPlus, keywords: "support assistance créer", permission: "support:write", run: () => go("/support?nouveau=1") },
		{ id: "new-plan", label: "Nouvelle offre", icon: LuPlus, keywords: "plan abonnement créer", permission: "subscriptions:write", run: () => go("/plans/new") },
		{ id: "new-promo", label: "Nouveau code promo", icon: LuPlus, keywords: "remise réduction créer", permission: "subscriptions:write", run: () => go("/plans/promo-codes?nouveau=1") },
		{ id: "invite-user", label: "Inviter un utilisateur", icon: LuPlus, keywords: "équipe agent ajouter", permission: "users:write", run: () => go("/users?nouveau=1") },
		{ id: "billing-settings", label: "Paramètres de facturation", icon: LuSettings2, keywords: "rib banque virement", permission: "billing:read", run: () => go("/billing/settings") },
		{ id: "theme-light", label: "Thème clair", icon: LuSun, keywords: "apparence mode jour", run: () => pick(() => setTheme("light")) },
		{ id: "theme-dark", label: "Thème sombre", icon: LuMoon, keywords: "apparence mode nuit dark", run: () => pick(() => setTheme("dark")) },
		{ id: "theme-system", label: "Thème du système", icon: LuMonitor, keywords: "apparence automatique", run: () => pick(() => setTheme("system")) },
		{ id: "shortcuts", label: "Raccourcis clavier", icon: LuKeyboard, keywords: "aide touches clavier", run: () => pick(() => window.dispatchEvent(new Event(SHORTCUTS_HELP_EVENT))) },
		{ id: "account-security", label: "Sécurité du compte", icon: LuShieldCheck, keywords: "2fa mot de passe double authentification", run: () => go("/account/security") },
		{ id: "sign-out", label: "Se déconnecter", icon: LuLogOut, keywords: "déconnexion quitter", run: () => pick(signOut) },
	];
	const visibleActions = actions.filter(
		(a) =>
			(!a.permission || can(permissions, a.permission)) &&
			(!input.trim() || fold(`${a.label} ${a.keywords ?? ""}`).includes(fold(input.trim()))),
	);

	const pages = allNavItems.filter(
		(item) =>
			(!item.permission || can(permissions, item.permission)) &&
			(!input.trim() || fold(item.title).includes(fold(input.trim()))),
	);
	const groups = searching ? toGroups(data) : [];
	const pending = searching && (isFetching || term !== input.trim());

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
		useSessionStore.getState().setSession(null);
		router.replace("/login");
		router.refresh();
	}
	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setInput("");
			setTerm("");
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="text-muted-foreground hover:bg-muted flex h-9 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm transition-colors sm:w-64"
				aria-label="Rechercher"
			>
				<LuSearch className="size-4 shrink-0" />
				<span className="hidden flex-1 text-start sm:inline">Rechercher…</span>
				<kbd className="bg-muted pointer-events-none hidden h-5 items-center rounded px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
					{modifier} K
				</kbd>
			</button>

			<CommandDialog
				open={open}
				onOpenChange={onOpenChange}
				title="Palette de commandes"
				description="Rechercher un cabinet, une facture, un ticket, un utilisateur, une page ou une action"
				className="sm:max-w-xl"
			>
				{/* The API already filters: cmdk must not filter again. */}
				<Command shouldFilter={false}>
					<div className="relative">
						<CommandInput
							value={input}
							onValueChange={setInput}
							placeholder="Rechercher ou lancer une action…"
						/>
						{pending && (
							<LuLoader className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
						)}
					</div>
					<CommandList className="max-h-[min(60vh,420px)]">
						{!pending && (
							<CommandEmpty>
								{searching ? `Aucun résultat pour « ${term} ».` : "Tapez au moins 2 caractères."}
							</CommandEmpty>
						)}
						{pages.length > 0 && (
							<CommandGroup heading="Pages">
								{pages.map((item) => (
									<CommandItem key={item.href} value={`page-${item.href}`} onSelect={() => go(item.href)}>
										<item.icon className="text-muted-foreground" />
										{item.title}
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
							<CommandGroup heading="Actions">
								{visibleActions.map((a) => (
									<CommandItem key={a.id} value={`action-${a.id}`} onSelect={a.run}>
										<a.icon className="text-muted-foreground" />
										{a.label}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{groups.map((group) => (
							<CommandGroup key={group.heading} heading={group.heading}>
								{group.items.map((r) => (
									<CommandItem
										key={r.key}
										value={r.key}
										onSelect={() => go(r.href)}
										className={cn("items-start", pending && "opacity-60")}
									>
										<r.icon className="text-muted-foreground mt-0.5" />
										<span className="grid min-w-0 flex-1 leading-tight">
											<span className="truncate">{r.title}</span>
											{r.subtitle && (
												<span className="text-muted-foreground truncate text-xs">{r.subtitle}</span>
											)}
										</span>
										{r.meta && <span className="text-muted-foreground shrink-0 text-xs">{r.meta}</span>}
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
					<div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-[11px]">
						<span>
							<kbd className="font-mono">↑↓</kbd> naviguer
						</span>
						<span>
							<kbd className="font-mono">↵</kbd> ouvrir
						</span>
						<span>
							<kbd className="font-mono">Échap</kbd> fermer
						</span>
					</div>
				</Command>
			</CommandDialog>
		</>
	);
}
