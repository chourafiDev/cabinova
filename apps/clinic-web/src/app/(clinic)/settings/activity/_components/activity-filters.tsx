"use client";

import { useRouter } from "next/navigation";
import { LuSearch } from "react-icons/lu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_CATEGORIES } from "@/lib/activity";

const ALL = "all";

/** Subject, person and a search on names; everything lives in the URL. */
export function ActivityFilters({
	category,
	userId,
	search,
	people,
}: {
	category?: string;
	userId?: string;
	search?: string;
	people: { id: string; name: string }[];
}) {
	const router = useRouter();
	const go = (changes: Record<string, string | undefined>) => {
		const next = { categorie: category, membre: userId, recherche: search, ...changes };
		const query = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
		router.push(`/settings/activity?${query}`, { scroll: false });
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select value={category ?? ALL} onValueChange={(v) => go({ categorie: v === ALL ? undefined : v })}>
				<SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Sujet">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Toute l’activité</SelectItem>
					{ACTIVITY_CATEGORIES.map((c) => (
						<SelectItem key={c.key} value={c.key}>
							{c.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={userId ?? ALL} onValueChange={(v) => go({ membre: v === ALL ? undefined : v })}>
				<SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Membre">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Toute l’équipe</SelectItem>
					{people.map((p) => (
						<SelectItem key={p.id} value={p.id}>
							{p.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<form
				className="relative min-w-48 flex-1"
				onSubmit={(e) => {
					e.preventDefault();
					go({ recherche: String(new FormData(e.currentTarget).get("q")).trim() || undefined });
				}}
			>
				<LuSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
				<Input key={search} name="q" defaultValue={search} placeholder="Patient, membre…" aria-label="Rechercher" className="h-8 ps-8" />
			</form>
		</div>
	);
}
