"use client";

import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { SOURCE_LABELS, type TenantFeatures } from "@/lib/features";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";
import { FeatureStatusBadge, LevelBadge } from "../../../features/_components/feature-badges";
import { OverrideDialog, type OverrideTarget } from "../../../features/_components/override-dialog";

/**
 * What this cabinet can use, feature by feature: its plan's level, any
 * exception (with dates), and the result with its reason (plan, exception,
 * beta, switched off). Exceptions are set from here or from the feature page.
 */
export function TenantFeaturesTab({
	tenantId,
	tenantName,
	data,
	canWrite,
}: {
	tenantId: string;
	tenantName: string;
	data: TenantFeatures;
	canWrite: boolean;
}) {
	const router = useRouter();
	const [target, setTarget] = useState<OverrideTarget | null>(null);
	const enabled = data.features.filter((f) => f.effective.enabled).length;

	const remove = async (key: string, name: string) => {
		try {
			await api(`/tenants/${tenantId}/features/${key}`, { method: "DELETE" });
			toast.success(`Exception retirée : ${name}`);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Suppression impossible");
		}
	};

	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";

	return (
		<FormCard
			title={
				<span>
					Fonctionnalités · <span className="tabular-nums">{enabled}</span> / {data.features.length} actives
					<span className="ms-2 text-xs font-normal text-muted-foreground">
						{data.plan ? `Offre ${data.plan}` : "Sans offre"}
					</span>
				</span>
			}
			contentClassName="p-0"
		>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[720px] text-sm">
					<thead>
						<tr className="border-b">
							<th className={th}>Fonctionnalité</th>
							<th className={th}>Offre</th>
							<th className={th}>Exception</th>
							<th className={th}>Résultat</th>
							<th className="w-0" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{data.features.map((f) => (
							<tr key={f.key}>
								<td className={td}>
									<Link href={`/features/${f.key}`} className="flex flex-wrap items-center gap-2 font-medium hover:underline">
										{f.name}
										{f.status !== "active" && <FeatureStatusBadge status={f.status} />}
									</Link>
								</td>
								<td className={td}>
									{f.planLevel ? <LevelBadge level={f.planLevel} /> : <span className="text-xs text-muted-foreground">—</span>}
								</td>
								<td className={td}>
									{f.override ? (
										<span className={cn("grid gap-0.5", !f.override.active && "opacity-60")}>
											<LevelBadge level={f.override.level} className="w-fit" />
											<span className="text-xs text-muted-foreground">
												{f.override.endsAt
													? `jusqu’au ${formatDate(f.override.endsAt, { month: "short" })}`
													: f.override.startsAt && !f.override.active
														? `dès le ${formatDate(f.override.startsAt, { month: "short" })}`
														: "sans fin"}
												{f.override.note && ` · ${f.override.note}`}
											</span>
										</span>
									) : (
										<span className="text-xs text-muted-foreground">—</span>
									)}
								</td>
								<td className={td}>
									<span className="flex items-center gap-1.5">
										{f.effective.enabled ? (
											<Check className="size-4 text-emerald-600" aria-label="Active" />
										) : (
											<Minus className="size-4 text-muted-foreground" aria-label="Inactive" />
										)}
										<span className={cn("text-xs", f.effective.source === "kill_switch" ? "text-red-700" : "text-muted-foreground")}>
											{SOURCE_LABELS[f.effective.source]}
										</span>
									</span>
								</td>
								<td className={cn(td, "whitespace-nowrap text-end")}>
									{canWrite && (
										<div className="flex justify-end gap-1">
											<Button
												size="sm"
												variant="ghost"
												onClick={() =>
													setTarget({
														featureKey: f.key,
														featureName: f.name,
														tenantId,
														tenantName,
														current: f.override,
													})
												}
											>
												{f.override ? "Modifier" : "Exception…"}
											</Button>
											{f.override && (
												<Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(f.key, f.name)}>
													Retirer
												</Button>
											)}
										</div>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{target && <OverrideDialog target={target} onClose={() => setTarget(null)} />}
		</FormCard>
	);
}
