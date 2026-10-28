import { LuPencil, LuPlus, LuTicketPercent } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiCreditCard } from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import type { FeatureRow } from "@/lib/features";
import { annualDiscount, formatLimit, formatPrice, formatStorage, type PlanRow } from "@/lib/plans";
import { plural } from "@/lib/plural";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { FeatureLevelBadge } from "./_components/feature-level";

export const metadata = { title: "Offres" };

/**
 * Module 3 — the plans catalog as the comparison matrix of the spec: one
 * column per plan, limits then features. Archived plans stay visible
 * (cabinets may still be on them) but greyed out.
 */
export default async function PlansPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:read")) notFound();
	const canWrite = can(session.user.permissions, "subscriptions:write");
	const [plans, catalog] = await Promise.all([apiGet<PlanRow[]>("/plans"), apiGet<FeatureRow[]>("/features").then((all) => all.filter((f) => f.implemented))]);

	const limits: { label: string; value: (p: PlanRow) => React.ReactNode }[] = [
		{ label: "Médecins", value: (p) => formatLimit(p.maxDoctors) },
		{ label: "Secrétaires", value: (p) => formatLimit(p.maxSecretaries) },
		{ label: "Utilisateurs", value: (p) => formatLimit(p.maxUsers) },
		{ label: "Stockage", value: (p) => formatStorage(p.storageQuotaMb) },
		{ label: "Essai gratuit", value: (p) => (p.trialDays ? `${p.trialDays} jours` : "Aucun") },
	];

	const th = "px-3 py-2 text-start font-normal text-muted-foreground";
	const td = (plan: PlanRow) => cn("px-3 py-2 align-top", !plan.active && "opacity-50");

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiCreditCard />}
				total={plans.length}
				label={{ singular: "Offre", plural: "Offres" }}
				action={
					<div className="flex w-full gap-2 md:w-auto">
						<Button asChild variant="outline">
							<Link href="/plans/promo-codes">
								<LuTicketPercent /> Codes promo
							</Link>
						</Button>
						{canWrite && (
							<Button asChild>
								<Link href="/plans/new">
									<LuPlus /> Nouvelle offre
								</Link>
							</Button>
						)}
					</div>
				}
			/>

			{plans.length === 0 ? (
				<FormCard>
					<p className="py-6 text-center text-sm text-muted-foreground">
						Aucune offre. Lancez <code>pnpm db:seed</code> pour créer Starter, Pro et Enterprise.
					</p>
				</FormCard>
			) : (
				<FormCard contentClassName="p-0 overflow-x-auto">
					<table className="w-full min-w-[640px] text-sm">
						<thead>
							<tr className="border-b">
								<th className={cn(th, "w-56")} />
								{plans.map((plan) => (
									<th key={plan.id} className={cn("px-3 py-3 text-start align-top font-normal", !plan.active && "opacity-50")}>
										<div className="flex items-start justify-between gap-2">
											<div className="grid gap-0.5">
												<span className="flex items-center gap-2 font-semibold">
													{plan.name}
													{!plan.active && <Badge variant="outline">Archivée</Badge>}
												</span>
												<code className="text-xs text-muted-foreground">{plan.key}</code>
											</div>
											{canWrite && (
												<Button asChild variant="ghost" size="icon-xs" aria-label={`Modifier ${plan.name}`}>
													<Link href={`/plans/${plan.id}`}>
														<LuPencil />
													</Link>
												</Button>
											)}
										</div>
										{plan.description && (
											<p className="mt-1 max-w-56 text-xs text-muted-foreground">{plan.description}</p>
										)}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y">
							<tr>
								<th className={th}>Tarif mensuel</th>
								{plans.map((p) => (
									<td key={p.id} className={cn(td(p), "font-semibold tabular-nums")}>
										{formatPrice(p.priceMonthly)}
									</td>
								))}
							</tr>
							<tr>
								<th className={th}>Tarif annuel</th>
								{plans.map((p) => {
									const discount = annualDiscount(p);
									return (
										<td key={p.id} className={cn(td(p), "tabular-nums")}>
											{formatPrice(p.priceAnnual)}
											{discount > 0 && <span className="ms-1.5 text-xs text-emerald-700">−{discount} %</span>}
										</td>
									);
								})}
							</tr>
							{limits.map((row) => (
								<tr key={row.label}>
									<th className={th}>{row.label}</th>
									{plans.map((p) => (
										<td key={p.id} className={td(p)}>
											{row.value(p)}
										</td>
									))}
								</tr>
							))}
							{catalog.map(({ key: feature, name }) => (
								<tr key={feature}>
									<th className={th}>{name}</th>
									{plans.map((p) => (
										<td key={p.id} className={td(p)}>
											<FeatureLevelBadge level={p.features[feature] ?? "none"} />
										</td>
									))}
								</tr>
							))}
							<tr>
								<th className={th}>Cabinets abonnés</th>
								{plans.map((p) => (
									<td key={p.id} className={cn(td(p), "tabular-nums")}>
										{plural(p.tenantCount, "cabinet")}
									</td>
								))}
							</tr>
						</tbody>
					</table>
				</FormCard>
			)}
			<p className="mt-3 text-xs text-muted-foreground">
				Les tarifs et limites s’appliquent aux cabinets créés ensuite : un cabinet existant garde les quotas copiés à
				sa création. L’encaissement des paiements arrivera avec le choix du prestataire de paiement.
			</p>
		</ListTransitionProvider>
	);
}
