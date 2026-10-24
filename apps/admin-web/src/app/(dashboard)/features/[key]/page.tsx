import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { FeatureDetail, FeatureRow } from "@/lib/features";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { TenantsPage } from "@/lib/tenants";
import { FormCard } from "../../_components/shared/form-card";
import { FeatureStatusBadge, LevelBadge } from "../_components/feature-badges";
import { FeatureOverrides } from "./feature-overrides";
import { FeatureSettings } from "./feature-settings";

export async function generateMetadata({ params }: PageProps<"/features/[key]">) {
	const feature = await apiGet<FeatureDetail>(`/features/${(await params).key}`);
	return { title: feature.name };
}

/** One feature: settings and kill switch, availability per plan, exceptions / testers. */
export default async function FeaturePage({ params }: PageProps<"/features/[key]">) {
	const { key } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:read")) notFound();
	const canWrite = can(session.user.permissions, "subscriptions:write");
	const [feature, rows, tenants] = await Promise.all([
		apiGet<FeatureDetail>(`/features/${key}`),
		apiGet<FeatureRow[]>("/features"),
		apiGet<TenantsPage>("/tenants?perPage=100&status=pending,provisioning,active,suspended,closure_pending&sort=name.asc"),
	]);
	const row = rows.find((r) => r.key === key);

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux fonctionnalités">
					<Link href="/features">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="grid min-w-0 leading-tight">
					<h1 className="flex items-center gap-2 font-semibold">
						{feature.name}
						<FeatureStatusBadge status={feature.status} />
					</h1>
					<code className="text-xs text-muted-foreground">{feature.key}</code>
				</div>
				{row && (
					<span className="ms-auto text-sm tabular-nums text-muted-foreground">
						<span className="font-semibold text-foreground">{row.cabinetsReached}</span> / {row.cabinetsTotal} cabinets y ont
						accès
					</span>
				)}
			</div>

			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
				<div className="grid gap-3">
					<FeatureSettings feature={feature} readOnly={!canWrite} />
					<FormCard
						title="Par offre"
						action={
							<Button asChild size="sm" variant="ghost">
								<Link href="/plans">Modifier dans Offres</Link>
							</Button>
						}
					>
						<ul className="grid gap-2 text-sm">
							{row?.plans.map((p) => (
								<li key={p.key} className="flex items-center justify-between gap-3">
									{p.name}
									<LevelBadge level={p.level} />
								</li>
							))}
						</ul>
						{feature.status === "beta" && (
							<p className="mt-3 text-xs text-muted-foreground">En bêta, ces niveaux ne s’appliquent pas encore.</p>
						)}
					</FormCard>
				</div>
				<FeatureOverrides
					feature={feature}
					tenants={tenants.data.map((t) => ({ id: t.id, name: t.name }))}
					canWrite={canWrite}
				/>
			</div>
		</>
	);
}
