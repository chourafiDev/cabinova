"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, type TicketPriority, type TicketType, TYPE_LABELS } from "@/lib/support";
import { useListTransition } from "../../_components/shared/list-transition";

const ALL = "__all";

/** Type, priority and search, kept in the URL (the view tabs are links). */
export function InboxFilters() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const { startTransition } = useListTransition();

	const set = (key: string, value: string | null) => {
		const next = new URLSearchParams(params);
		next.delete("page");
		if (!value || value === ALL) next.delete(key);
		else next.set(key, value);
		startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
	};
	const active = ["type", "priority", "search", "tenantId"].some((k) => params.has(k));

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select value={params.get("type") ?? ALL} onValueChange={(v) => set("type", v)}>
				<SelectTrigger size="sm" className="min-w-36" aria-label="Type">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Tous les types</SelectItem>
					{(Object.keys(TYPE_LABELS) as TicketType[]).map((t) => (
						<SelectItem key={t} value={t}>
							{TYPE_LABELS[t]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={params.get("priority") ?? ALL} onValueChange={(v) => set("priority", v)}>
				<SelectTrigger size="sm" className="min-w-36" aria-label="Priorité">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Toutes priorités</SelectItem>
					{(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
						<SelectItem key={p} value={p}>
							{PRIORITY_LABELS[p]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<form
				className="w-full sm:w-60"
				onSubmit={(e) => {
					e.preventDefault();
					set("search", String(new FormData(e.currentTarget).get("search") ?? "").trim() || null);
				}}
			>
				<Input name="search" defaultValue={params.get("search") ?? ""} placeholder="N°, objet, cabinet, contact…" className="h-8" />
			</form>
			{active && (
				<Button
					size="sm"
					variant="ghost"
					onClick={() => {
						const view = params.get("view");
						startTransition(() => router.replace(view ? `${pathname}?view=${view}` : pathname, { scroll: false }));
					}}
				>
					<X /> Réinitialiser
				</Button>
			)}
		</div>
	);
}
