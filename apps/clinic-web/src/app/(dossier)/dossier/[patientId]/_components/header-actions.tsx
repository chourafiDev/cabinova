"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Kbd, useModifierLabel } from "@/components/keyboard-shortcuts";
import { IconChevronDown, IconHistory, IconKeyboard, IconPrinter, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import type { Certificate } from "@/lib/certificates";
import { type LabRequest, labRequestsKey } from "@/lib/lab-requests";
import { type Letter, lettersKey } from "@/lib/letters";
import { useFormat } from "@/lib/use-format";
import { usePrintDialog } from "@/components/print-dialog";

/** "Renouveler l'ordonnance": the last ordonnance's lines into today's, then its tab. */
export function RenewButton({ date, onRenew }: { date: string; onRenew: () => void }) {
	const t = useTranslations("dossier.headerActions");
	const format = useFormat();
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={onRenew}
			title={t("renewTitle", { date: format.date(date) })}
		>
			<IconHistory /> <span className="hidden 2xl:inline">{t("renew")}</span>
			<span className="2xl:hidden">{t("renewShort")}</span>
		</Button>
	);
}

type Printable = { key: string; label: string; href: string };

/**
 * "Imprimer ▾": everything written at this visit, in one menu (ordonnance,
 * certificates, bilans biologiques, comptes rendus, letters), each opened on
 * its print page. What is being typed is saved first.
 */
export function PrintMenu({
	patientId,
	appointmentId,
	prescriptionLines,
	beforePrint,
}: {
	patientId: string;
	appointmentId: string;
	/** Lines of today's ordonnance (printable when there is at least one). */
	prescriptionLines: number;
	/** Saves what is still being typed; false when it can't be. */
	beforePrint: () => Promise<boolean>;
}) {
	const t = useTranslations("dossier.headerActions");
	const [open, setOpen] = useState(false);
	const [opening, setOpening] = useState<string | null>(null);
	const openPrint = usePrintDialog();

	// Loaded when the menu opens, under the tabs' keys (the same cache).
	const certificates = useQuery({
		queryKey: ["certificates", "visit", appointmentId],
		queryFn: () => api<Certificate[]>(`/certificates/visit/${appointmentId}`),
		enabled: open,
	});
	const labRequests = useQuery({
		queryKey: labRequestsKey(patientId),
		queryFn: () => api<LabRequest[]>(`/lab-requests?patientId=${patientId}`),
		enabled: open,
	});
	const reports = useQuery({
		queryKey: lettersKey(patientId, "report"),
		queryFn: () => api<Letter[]>(`/letters?patientId=${patientId}&kind=report`),
		enabled: open,
	});
	const letters = useQuery({
		queryKey: lettersKey(patientId, "letter"),
		queryFn: () => api<Letter[]>(`/letters?patientId=${patientId}&kind=letter`),
		enabled: open,
	});
	const loading = [certificates, labRequests, reports, letters].some((q) => q.isPending);
	const ofVisit = <T extends { appointmentId: string | null }>(list: T[] | undefined) =>
		(list ?? []).filter((x) => x.appointmentId === appointmentId);
	/** One line per document; a number when the visit has several of a kind ("Lettre 1", "Lettre 2"), in writing order. */
	const lines = <T extends { id: string; createdAt: string }>(list: T[], prefix: string, label: string, href: (x: T) => string) => {
		const ordered = list.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
		return ordered.map((x, i) => ({
			key: `${prefix}-${x.id}`,
			label: ordered.length > 1 ? `${label} ${i + 1}` : label,
			href: href(x),
		}));
	};

	const items: Printable[] = [
		...(prescriptionLines > 0
			? [{ key: "rx", label: t("prescription", { count: prescriptionLines }), href: `/ordonnances/${appointmentId}` }]
			: []),
		...lines((certificates.data ?? []).filter((c) => !c.cancelledAt), "cert", t("certificate"), (c) => `/certificats/${c.id}`),
		...lines(ofVisit(labRequests.data), "lab", t("labRequest"), (r) => `/bilans/${r.id}`),
		...lines(ofVisit(reports.data), "report", t("report"), (r) => `/lettres/${r.id}`),
		...lines(ofVisit(letters.data), "letter", t("letter"), (l) => `/lettres/${l.id}`),
	];

	const print = async (item: Printable) => {
		setOpening(item.key);
		// The ordonnance's last lines are saved before its page reads them.
		const ok = await beforePrint();
		setOpening(null);
		if (ok) openPrint(item.href);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<IconPrinter /> <span className="hidden xl:inline">{t("print")}</span>
					<IconChevronDown className="size-3.5 opacity-60" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-64">
				<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t("printTitle")}</DropdownMenuLabel>
				{items.map((item) => (
					<DropdownMenuItem
						key={item.key}
						disabled={!!opening}
						onSelect={(e) => {
							e.preventDefault();
							void print(item).then(() => setOpen(false));
						}}
					>
						{opening === item.key ? <IconSpinner className="animate-spin" /> : <IconPrinter />}
						{item.label}
					</DropdownMenuItem>
				))}
				{loading && (
					<p className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs">
						<IconSpinner className="size-3.5 animate-spin" /> {t("loading")}
					</p>
				)}
				{!loading && items.length === 0 && <p className="text-muted-foreground px-2 py-1.5 text-xs">{t("nothing")}</p>}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** "?": the dossier's keyboard shortcuts, so they get used. */
export function ShortcutsHelp({ tabs }: { tabs: string[] }) {
	const t = useTranslations("dossier.headerActions");
	const mod = useModifierLabel();
	const rows: { keys: string[]; label: string }[] = [
		{ keys: ["1", "…", String(Math.min(9, tabs.length))], label: t("keys.tabs") },
		{ keys: [mod, "S"], label: t("keys.save") },
		{ keys: [mod, "B"], label: t("keys.bold") },
		{ keys: [mod, "I"], label: t("keys.italic") },
		{ keys: [mod, "U"], label: t("keys.underline") },
		{ keys: [mod, "Z"], label: t("keys.undo") },
		{ keys: ["Échap"], label: t("keys.escape") },
	];
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="icon" className="size-[26px] rounded-md" aria-label={t("shortcuts")} title={t("shortcuts")}>
					<IconKeyboard />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="grid w-80 gap-3 p-4 text-sm">
				<p className="font-semibold">{t("shortcuts")}</p>
				<ul className="grid gap-1.5">
					{rows.map((r) => (
						<li key={r.label} className="flex items-center justify-between gap-3">
							<span className="text-muted-foreground text-xs">{r.label}</span>
							<span className="flex shrink-0 gap-1">
								{r.keys.map((k, i) => (k === "…" ? <span key={i} className="text-muted-foreground text-xs">…</span> : <Kbd key={i}>{k}</Kbd>))}
							</span>
						</li>
					))}
				</ul>
				<div className="grid gap-1 border-t pt-2">
					<p className="text-muted-foreground text-xs">{t("tabsList")}</p>
					<ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
						{tabs.slice(0, 9).map((label, i) => (
							<li key={label} className="flex items-center gap-1.5">
								<Kbd>{i + 1}</Kbd>
								<span className="truncate">{label}</span>
							</li>
						))}
					</ol>
				</div>
			</PopoverContent>
		</Popover>
	);
}
