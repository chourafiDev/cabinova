import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { EMPTY_PLAN, type PlanRow } from "@/lib/plans";
import { getSession } from "@/lib/session";
import type { FeatureRow } from "@/lib/features";
import { apiGet } from "@/lib/server-api";
import { PlanForm } from "../_components/plan-form";

export const metadata = { title: "Nouvelle offre" };

export default async function NewPlanPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:write")) notFound();
	const [catalog, templates] = await Promise.all([
		apiGet<FeatureRow[]>("/features"),
		apiGet<PlanRow[]>("/plans?active=true"),
	]);

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux offres">
					<Link href="/plans">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Nouvelle offre</h1>
			</div>
			<PlanForm mode="create" defaultValues={EMPTY_PLAN} catalog={catalog} templates={templates} />
		</>
	);
}
