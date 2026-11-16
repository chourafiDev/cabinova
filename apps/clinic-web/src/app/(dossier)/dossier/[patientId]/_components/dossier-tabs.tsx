"use client";

import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** A tab of the dossier, with what it shows on its label. */
export type DossierTab<T extends string> = {
	value: T;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	/** A count (documents, results, lines…); hidden at 0. */
	badge?: number;
	/** Work not saved yet ("pending"), or that couldn't be ("error"). */
	dot?: "pending" | "error";
};

/** Room kept for the "Plus" button when some tabs don't fit. */
const MORE_WIDTH = 104;
/** TabsList padding and the gap between triggers, in px. */
const LIST_PADDING = 6;

/**
 * The dossier's tabs on one line, whatever the width: those that fit, then
 * "Plus ▾" with the others (showing the active one when it is there).
 * Keys 1–9 open a tab (the number is on each tab's tooltip and in the menu).
 */
export function DossierTabs<T extends string>({
	tabs,
	current,
	onSelect,
}: {
	tabs: DossierTab<T>[];
	current: T;
	onSelect: (value: T) => void;
}) {
	const t = useTranslations("dossier.tabsBar");
	const box = useRef<HTMLDivElement>(null);
	const measures = useRef<(HTMLSpanElement | null)[]>([]);
	const [fit, setFit] = useState(tabs.length);

	// How many tabs fit: measured on hidden copies, again whenever the width changes.
	useLayoutEffect(() => {
		const el = box.current;
		if (!el) return;
		const compute = () => {
			const widths = measures.current.map((m) => m?.offsetWidth ?? 0);
			const room = el.clientWidth - LIST_PADDING;
			const total = widths.reduce((s, w) => s + w, 0);
			if (total <= room) return setFit(tabs.length);
			let used = MORE_WIDTH;
			let n = 0;
			while (n < widths.length && used + widths[n] <= room) used += widths[n++];
			setFit(Math.max(1, n));
		};
		compute();
		const observer = new ResizeObserver(compute);
		observer.observe(el);
		return () => observer.disconnect();
	}, [tabs]);

	// Keys 1–9: the tab with that number, unless the doctor is typing or a dialog is open.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !/^[1-9]$/.test(e.key)) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
			if (document.querySelector("[role=dialog]")) return;
			const tab = tabs[Number(e.key) - 1];
			if (!tab) return;
			e.preventDefault();
			onSelect(tab.value);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [tabs, onSelect]);

	const shown = tabs.slice(0, fit);
	const more = tabs.slice(fit);
	const activeMore = more.find((tab) => tab.value === current);

	return (
		<div ref={box} className="relative w-full min-w-0">
			{/* Hidden copies, to measure each tab at its natural width. */}
			<div aria-hidden className="pointer-events-none invisible absolute flex h-0 overflow-hidden">
				{tabs.map((tab, i) => (
					<span
						key={tab.value}
						ref={(el) => {
							measures.current[i] = el;
						}}
						className="inline-flex items-center gap-1.5 border border-transparent px-3 text-sm font-medium whitespace-nowrap"
					>
						<TabLabel tab={tab} />
					</span>
				))}
			</div>

			<TabsList className="w-full justify-start overflow-hidden">
				{shown.map((tab, i) => (
					<TabsTrigger
						key={tab.value}
						value={tab.value}
						className="flex-none px-3"
						title={t("shortcut", { label: tab.label, key: i + 1 })}
					>
						<TabLabel tab={tab} />
					</TabsTrigger>
				))}
				{more.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger
							className={cn(
								"text-foreground/60 hover:text-foreground relative ms-auto inline-flex h-[calc(100%-1px)] flex-none items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap",
								activeMore && "bg-background text-foreground shadow-sm",
							)}
						>
							{activeMore ? <TabLabel tab={activeMore} /> : t("more")}
							{/* Unsaved work in a hidden tab still shows. */}
							{!activeMore && more.some((tab) => tab.dot) && (
								<Dot kind={more.some((tab) => tab.dot === "error") ? "error" : "pending"} />
							)}
							<IconChevronDown className="size-3.5 opacity-60" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-56">
							{more.map((tab, i) => (
								<DropdownMenuItem
									key={tab.value}
									onSelect={() => onSelect(tab.value)}
									className={cn("group/item", tab.value === current && "font-semibold")}
								>
									<TabLabel tab={tab} />
									{fit + i < 9 && (
										// Readable on the highlighted (plum) row too.
										<kbd className="bg-muted text-muted-foreground group-data-highlighted/item:border-white/40 group-data-highlighted/item:bg-white/20 group-data-highlighted/item:text-current ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] font-medium">
											{fit + i + 1}
										</kbd>
									)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</TabsList>
		</div>
	);
}

function TabLabel<T extends string>({ tab }: { tab: DossierTab<T> }) {
	const Icon = tab.icon;
	return (
		<>
			<Icon className="size-4 shrink-0" /> {tab.label}
			{!!tab.badge && (
				<span className="bg-primary/12 text-primary rounded px-1.5 text-xs tabular-nums">{tab.badge}</span>
			)}
			{tab.dot && <Dot kind={tab.dot} />}
		</>
	);
}

/** Amber while work isn't saved yet, red when it couldn't be. */
function Dot({ kind }: { kind: "pending" | "error" }) {
	const t = useTranslations("dossier.tabsBar");
	return (
		<span
			role="img"
			aria-label={kind === "error" ? t("saveError") : t("unsaved")}
			title={kind === "error" ? t("saveError") : t("unsaved")}
			className={cn("size-1.5 shrink-0 rounded-full", kind === "error" ? "bg-destructive" : "bg-amber-500")}
		/>
	);
}
