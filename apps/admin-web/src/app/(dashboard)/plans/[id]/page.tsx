import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { type Plan, toPlanInput } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { FeatureRow } from "@/lib/features";
import { PlanForm } from "../_components/plan-form";

export async function generateMetadata({ params }: PageProps<"/plans/[id]">) {
	const plan = await apiGet<Plan>(`/plans/${(await params).id}`);
	return { title: `Offre ${plan.name}` };
}

/** Every saved change is recorded in the platform audit log (plan.update). */
export default async function EditPlanPage({ params }: PageProps<"/plans/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:write")) notFound();
	const [plan, catalog] = await Promise.all([apiGet<Plan>(`/plans/${id}`), apiGet<FeatureRow[]>("/features")]);

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux offres">
					<Link href="/plans">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Modifier l’offre {plan.name}</h1>
			</div>
			<PlanForm mode="edit" planId={id} defaultValues={toPlanInput(plan)} catalog={catalog} />
		</>
	);
}
