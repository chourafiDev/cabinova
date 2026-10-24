"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { FeatureDetail, FeatureOverride } from "@/lib/features";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";
import { LevelBadge } from "../_components/feature-badges";
import { OverrideDialog, type OverrideTarget } from "../_components/override-dialog";

const period = (o: FeatureOverride) =>
	!o.startsAt && !o.endsAt
		? "Sans limite"
		: `${o.startsAt ? `du ${formatDate(o.startsAt, { month: "short" })}` : "dès maintenant"} ${
				o.endsAt ? `au ${formatDate(o.endsAt, { month: "short" })}` : "sans fin"
			}`;

/** Per-cabinet exceptions for one feature — the testers, for a beta. */
export function FeatureOverrides({
	feature,
	tenants,
	canWrite,
}: {
	feature: FeatureDetail;
	tenants: { id: string; name: string }[];
	canWrite: boolean;
}) {
	const router = useRouter();
	const [target, setTarget] = useState<OverrideTarget | null>(null);
	const beta = feature.status === "beta";
	const taken = new Set(feature.overrides.map((o) => o.tenantId));

	const remove = async (o: FeatureOverride) => {
		try {
			await api(`/tenants/${o.tenantId}/features/${feature.key}`, { method: "DELETE" });
			toast.success(`Exception retirée pour ${o.tenantName}`);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Suppression impossible");
		}
	};

	return (
		<FormCard
			title={beta ? `Cabinets testeurs (${feature.overrides.length})` : `Exceptions par cabinet (${feature.overrides.length})`}
			action={
				canWrite && (
					<Button size="sm" variant="outline" onClick={() => setTarget({ featureKey: feature.key, featureName: feature.name })}>
						<Plus /> {beta ? "Ajouter un testeur" : "Ajouter une exception"}
					</Button>
				)
			}
			contentClassName="p-0"
		>
			{feature.overrides.length === 0 ? (
				<p className="px-3 py-6 text-center text-sm text-muted-foreground">
					{beta
						? "Aucun testeur : la fonctionnalité n’est disponible pour personne."
						: "Aucune exception : chaque cabinet suit son offre."}
				</p>
			) : (
				<ul className="divide-y">
					{feature.overrides.map((o) => (
						<li key={o.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm", !o.active && "opacity-60")}>
							<div className="grid min-w-0 flex-1 gap-0.5">
								<Link href={`/tenants/${o.tenantId}?tab=features`} className="font-medium hover:underline">
									{o.tenantName}
								</Link>
								<span className="text-xs text-muted-foreground">
									{period(o)}
									{!o.active && " · inactive aujourd’hui"}
									{o.note && ` · ${o.note}`}
								</span>
							</div>
							<LevelBadge level={o.level} />
							{canWrite && (
								<div className="flex gap-1">
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											setTarget({
												featureKey: feature.key,
												featureName: feature.name,
												tenantId: o.tenantId,
												tenantName: o.tenantName,
												current: o,
											})
										}
									>
										Modifier
									</Button>
									<Button size="icon-sm" variant="ghost" aria-label={`Retirer l’exception de ${o.tenantName}`} onClick={() => remove(o)}>
										<Trash2 />
									</Button>
								</div>
							)}
						</li>
					))}
				</ul>
			)}
			{target && (
				<OverrideDialog target={target} tenants={tenants.filter((t) => !taken.has(t.id))} onClose={() => setTarget(null)} />
			)}
		</FormCard>
	);
}
