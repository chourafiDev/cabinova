"use client";

import { Download, ShieldAlert, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_PERIODS, type SecuritySummary } from "@/lib/security";
import { cn } from "@/lib/utils";

const ALL = "__all";

/** One row of filters, kept in the URL; the export downloads exactly what's filtered. */
export function JournalFilters({ summary, exportHref }: { summary: SecuritySummary; exportHref: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [pending, startTransition] = useTransition();

	const set = (key: string, value: string | null) => {
		const next = new URLSearchParams(params);
		next.delete("page");
		if (!value || value === ALL) next.delete(key);
		else next.set(key, value);
		startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
	};
	const category = params.get("category") ?? ALL;
	const sensitive = params.get("sensitive") === "true";
	const active = ["category", "period", "actor", "sensitive", "search"].some((k) => params.has(k));

	return (
		<div className={cn("grid gap-2", pending && "opacity-70")}>
			<div className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px] text-sm" role="tablist" aria-label="Catégorie">
				{[{ key: ALL, label: "Tout" }, ...summary.categories].map((c) => (
					<button
						key={c.key}
						type="button"
						role="tab"
						aria-selected={category === c.key}
						onClick={() => set("category", c.key)}
						className={cn(
							"rounded-md px-3 py-1 text-muted-foreground",
							category === c.key && "bg-background text-foreground shadow-sm",
						)}
					>
						{c.label}
					</button>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Select value={params.get("period") ?? "30d"} onValueChange={(v) => set("period", v === "30d" ? null : v)}>
					<SelectTrigger size="sm" className="min-w-44" aria-label="Période">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(AUDIT_PERIODS).map(([key, p]) => (
							<SelectItem key={key} value={key}>
								{p.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={params.get("actor") ?? ALL} onValueChange={(v) => set("actor", v)}>
					<SelectTrigger size="sm" className="min-w-44" aria-label="Auteur">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Tous les auteurs</SelectItem>
						{summary.actors.map((a) => (
							<SelectItem key={a.id} value={a.id}>
								{a.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					type="button"
					size="sm"
					variant={sensitive ? "default" : "outline"}
					aria-pressed={sensitive}
					onClick={() => set("sensitive", sensitive ? null : "true")}
				>
					<ShieldAlert /> Sensibles uniquement
				</Button>
				<form
					className="w-full sm:w-56"
					onSubmit={(e) => {
						e.preventDefault();
						set("search", String(new FormData(e.currentTarget).get("search") ?? "").trim() || null);
					}}
				>
					<Input name="search" defaultValue={params.get("search") ?? ""} placeholder="Rechercher (IP, cabinet, n°…)" className="h-8" />
				</form>
				{active && (
					<Button type="button" size="sm" variant="ghost" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}>
						<X /> Réinitialiser
					</Button>
				)}
				<Button asChild size="sm" variant="outline" className="ms-auto">
					<a href={exportHref} download>
						<Download /> Exporter (Excel)
					</a>
				</Button>
			</div>
		</div>
	);
}
