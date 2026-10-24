import { ChevronRight, Power } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiPuzzlePiece } from "react-icons/hi2";
import type { FeatureRow } from "@/lib/features";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { CreateFeatureDialog } from "./_components/create-feature-dialog";
import { FeatureStatusBadge, LevelBadge } from "./_components/feature-badges";

export const metadata = { title: "Fonctionnalités" };

/**
 * "Fonctionnalités et options": every clinic-side feature, its level per
 * plan, how many cabinets can use it right now, and its exceptions. A
 * disabled feature (incident) is off everywhere; a beta one only for testers.
 */
export default async function FeaturesPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:read")) notFound();
	const features = await apiGet<FeatureRow[]>("/features");
	const disabled = features.filter((f) => f.status === "disabled");
	const groups = [...new Set(features.map((f) => f.category ?? "Autres"))].map((category) => ({
		category,
		features: features.filter((f) => (f.category ?? "Autres") === category),
	}));

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiPuzzlePiece />}
				total={features.length}
				label={{ singular: "Fonctionnalité", plural: "Fonctionnalités" }}
				action={can(session.user.permissions, "subscriptions:write") ? <CreateFeatureDialog /> : undefined}
			/>

			{disabled.length > 0 && (
				<div className="mb-3 grid gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
					{disabled.map((f) => (
						<p key={f.key} className="flex items-center gap-2">
							<Power className="size-4 shrink-0" />
							<span>
								<Link href={`/features/${f.key}`} className="font-medium hover:underline">
									{f.name}
								</Link>{" "}
								est désactivée pour tous les cabinets{f.disabledReason ? ` — ${f.disabledReason}` : ""}.
							</span>
						</p>
					))}
				</div>
			)}

			<div className="grid gap-3">
				{groups.map((group) => (
					<FormCard key={group.category} title={group.category} contentClassName="p-0">
						<ul className="divide-y">
							{group.features.map((f) => {
								const share = f.cabinetsTotal ? Math.round((f.cabinetsReached / f.cabinetsTotal) * 100) : 0;
								return (
									<li key={f.key}>
										<Link
											href={`/features/${f.key}`}
											className="grid items-center gap-3 px-3 py-3 hover:bg-muted/50 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]"
										>
											<div className="grid min-w-0 gap-0.5">
												<span className="flex flex-wrap items-center gap-2 text-sm font-medium">
													{f.name}
													{f.status !== "active" && <FeatureStatusBadge status={f.status} />}
												</span>
												<code className="truncate text-xs text-muted-foreground">{f.key}</code>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{f.plans.map((p) => (
													<span key={p.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
														{p.name}
														<LevelBadge level={p.level} />
													</span>
												))}
											</div>
											<div className="grid gap-1 text-xs">
												<span className="tabular-nums">
													<span className={cn("font-medium", f.status === "disabled" && "text-red-700")}>
														{f.cabinetsReached}
													</span>
													<span className="text-muted-foreground"> / {f.cabinetsTotal} cabinets</span>
													{f.overrides > 0 && (
														<span className="text-muted-foreground">
															{" "}
															· {f.overrides} exception{f.overrides > 1 ? "s" : ""}
														</span>
													)}
												</span>
												<span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
													<span className="block h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
												</span>
											</div>
											<ChevronRight className="hidden size-4 text-muted-foreground md:block" />
										</Link>
									</li>
								);
							})}
						</ul>
					</FormCard>
				))}
			</div>
			<p className="mt-3 text-xs text-muted-foreground">
				Les niveaux par offre se modifient depuis Offres. « Cabinets » = cabinets non fermés qui peuvent utiliser la
				fonctionnalité aujourd’hui (offre, exceptions, bêta et désactivation pris en compte).
			</p>
		</ListTransitionProvider>
	);
}
