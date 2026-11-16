"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { AVAILABILITY_LABELS } from "@/lib/medicines";
import { cn } from "@/lib/utils";

const TABS = [
	{ key: null, label: "Tous" },
	{ key: "marketed", label: AVAILABILITY_LABELS.marketed },
	{ key: "not_marketed", label: AVAILABILITY_LABELS.not_marketed },
	{ key: "withdrawn", label: AVAILABILITY_LABELS.withdrawn },
	{ key: "inactive", label: "Absents du fichier" },
] as const;

/** Search (brand or substance) and status, kept in the URL. */
export function MedicinesFilters({ q, availability }: { q: string; availability: string | undefined }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [pending, startTransition] = useTransition();
	const [text, setText] = useState(q);

	const set = (key: string, value: string | null) => {
		const next = new URLSearchParams(params);
		next.delete("page");
		if (value) next.set(key, value);
		else next.delete(key);
		startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
	};

	// Searches once typing pauses.
	useEffect(() => {
		if (text.trim() === q) return;
		const timer = setTimeout(() => set("q", text.trim() || null), 300);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [text]);

	return (
		<div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70")}>
			<div className="relative w-full sm:w-72">
				<IconSearch className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="Nom commercial ou substance…"
					aria-label="Rechercher un médicament"
					className="h-8 ps-8"
				/>
			</div>
			<div className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px] text-xs" role="tablist" aria-label="Statut">
				{TABS.map((tab) => {
					const selected = (availability ?? null) === tab.key;
					return (
						<button
							key={tab.label}
							type="button"
							role="tab"
							aria-selected={selected}
							onClick={() => set("disponibilite", tab.key)}
							className={cn(
								"rounded-md px-2.5 py-1 text-muted-foreground",
								selected && "bg-background text-foreground shadow-sm",
							)}
						>
							{tab.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
