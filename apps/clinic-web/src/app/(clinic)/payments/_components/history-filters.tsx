"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HISTORY_PRESETS, type HistoryPreset, METHODS } from "@/lib/payments";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";

const ALL = "all";

/** One row above the history or the closes: period, then space and method. */
export function HistoryFilters({
	view,
	preset,
	space,
	method,
	spaces,
}: {
	view: "historique" | "clotures";
	preset: HistoryPreset;
	space: string | null;
	method: string | null;
	spaces: { id: string; name: string; city: string | null }[];
}) {
	const router = useRouter();
	const go = (changes: Record<string, string | null>) => {
		const params = new URLSearchParams({ vue: view, periode: preset });
		if (space) params.set("espace", space);
		if (method) params.set("mode", method);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null) params.delete(k);
			else params.set(k, v);
		}
		router.push(`/payments?${params}`, { scroll: false });
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="bg-muted flex rounded-lg p-0.5 text-sm" role="group" aria-label="Période">
				{HISTORY_PRESETS.map((p) => (
					<button
						key={p.key}
						type="button"
						aria-pressed={preset === p.key}
						onClick={() => go({ periode: p.key, page: null })}
						className={cn(
							"rounded-md px-3 py-1 whitespace-nowrap transition-colors",
							preset === p.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{p.label}
					</button>
				))}
			</div>
			{spaces.length > 1 && (
				<Select value={space ?? ALL} onValueChange={(v) => go({ espace: v === ALL ? null : v, page: null })}>
					<SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Espace">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Tous les espaces</SelectItem>
						{spaces.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{spaceLabel(s)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			{view === "historique" && (
				<Select value={method ?? ALL} onValueChange={(v) => go({ mode: v === ALL ? null : v, page: null })}>
					<SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Mode de paiement">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Tous les modes</SelectItem>
						{METHODS.map((m) => (
							<SelectItem key={m.value} value={m.value}>
								{m.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	);
}
