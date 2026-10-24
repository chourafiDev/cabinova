"use client";

import { Download, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DashboardOverview, PERIODS } from "@/lib/dashboard";
import { STATUS_LABELS } from "@/lib/tenants";
import { cn } from "@/lib/utils";

const ALL = "__all";

/**
 * Module 1 filters, in one row above the figures: creation period, status,
 * city, specialty, plan. Kept in the URL so a filtered view can be shared;
 * the export downloads exactly what is shown.
 */
export function DashboardFilters({
	options,
	exportHref,
	children,
}: {
	options: DashboardOverview["filters"];
	exportHref: string;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [pending, startTransition] = useTransition();

	const set = (key: string, value: string) => {
		const next = new URLSearchParams(params);
		if (value === ALL) next.delete(key);
		else next.set(key, value);
		startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
	};
	const active = ["period", "status", "city", "specialty", "plan"].some((k) => params.has(k));

	const select = (key: string, label: string, items: { value: string; label: string }[], allLabel: string) => (
		<Select value={params.get(key) ?? ALL} onValueChange={(v) => set(key, v)}>
			<SelectTrigger size="sm" aria-label={label} className={cn("min-w-36", params.has(key) && "border-primary")}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL}>{allLabel}</SelectItem>
				{items.map((i) => (
					<SelectItem key={i.value} value={i.value}>
						{i.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<Select value={params.get("period") ?? "all"} onValueChange={(v) => set("period", v === "all" ? ALL : v)}>
					<SelectTrigger size="sm" aria-label="Période de création" className={cn("min-w-40", params.has("period") && "border-primary")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(PERIODS).map(([key, p]) => (
							<SelectItem key={key} value={key}>
								{key === "all" ? p.label : `Créés : ${p.label.toLowerCase()}`}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{select(
					"status",
					"Statut",
					Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
					"Tous les statuts",
				)}
				{select(
					"plan",
					"Offre",
					[...options.plans.map((p) => ({ value: p.key, label: p.name })), { value: "none", label: "Sans offre" }],
					"Toutes les offres",
				)}
				{select("city", "Ville", options.cities.map((c) => ({ value: c, label: c })), "Toutes les villes")}
				{select(
					"specialty",
					"Spécialité",
					options.specialties.map((s) => ({ value: s, label: s })),
					"Toutes les spécialités",
				)}
				{active && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
					>
						<X /> Réinitialiser
					</Button>
				)}
				<Button asChild variant="outline" size="sm" className="ms-auto">
					<a href={exportHref} download>
						<Download /> Exporter (Excel)
					</a>
				</Button>
			</div>
			<div className={cn("transition-opacity", pending && "opacity-60")}>{children}</div>
		</>
	);
}
