import { LuArrowLeft } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PromoCode } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { PlanRow } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";
import { NewPromoCodeDialog, PromoActiveSwitch } from "./promo-code-actions";

export const metadata = { title: "Codes promo" };

const STATE: Record<PromoCode["state"], { label: string; tone: string }> = {
	active: { label: "Actif", tone: "bg-emerald-50 text-emerald-700" },
	disabled: { label: "Désactivé", tone: "bg-zinc-100 text-zinc-600" },
	expired: { label: "Expiré", tone: "bg-zinc-100 text-zinc-600" },
	exhausted: { label: "Épuisé", tone: "bg-amber-50 text-amber-800" },
};

/**
 * Codes promo: a percentage off a cabinet's next invoices, for a number of
 * invoices or the whole subscription. Applied from the cabinet's Abonnement
 * tab; the better of the code and the commercial discount applies.
 */
export default async function PromoCodesPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "subscriptions:read")) notFound();
	const canWrite = can(session.user.permissions, "subscriptions:write");
	const [codes, plans] = await Promise.all([apiGet<PromoCode[]>("/billing/promo-codes"), apiGet<PlanRow[]>("/plans")]);
	const planName = (key: string) => plans.find((p) => p.key === key)?.name ?? key;
	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild size="icon-sm" variant="ghost" aria-label="Retour aux offres">
					<Link href="/plans">
						<LuArrowLeft />
					</Link>
				</Button>
				<div className="grid leading-tight">
					<h1 className="font-semibold">Codes promo</h1>
					<span className="text-xs text-muted-foreground">
						Appliqués depuis l’onglet Abonnement d’un cabinet. Un code par cabinet ; la remise la plus avantageuse
						s’applique, sans cumul.
					</span>
				</div>
				{canWrite && (
					<div className="ms-auto">
						<NewPromoCodeDialog plans={plans.filter((p) => p.active).map((p) => ({ key: p.key, name: p.name }))} />
					</div>
				)}
			</div>

			<FormCard contentClassName="p-0 overflow-x-auto">
				{codes.length === 0 ? (
					<p className="py-10 text-center text-sm text-muted-foreground">Aucun code promo pour l’instant.</p>
				) : (
					<table className="w-full min-w-[760px] text-sm">
						<thead>
							<tr className="border-b">
								<th className={th}>Code</th>
								<th className={th}>Remise</th>
								<th className={th}>Offres</th>
								<th className={th}>Utilisations</th>
								<th className={th}>Valable jusqu’au</th>
								<th className={th}>État</th>
								{canWrite && <th className={cn(th, "text-end")}>Actif</th>}
							</tr>
						</thead>
						<tbody className="divide-y">
							{codes.map((c) => (
								<tr key={c.id} className={cn(c.state !== "active" && "text-muted-foreground")}>
									<td className={td}>
										<span className="grid leading-tight">
											<span className="font-mono font-medium text-foreground">{c.code}</span>
											{c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
										</span>
									</td>
									<td className={td}>
										<span className="font-medium tabular-nums">−{c.discountPercent} %</span>
										<span className="block text-xs text-muted-foreground">
											{c.durationInvoices
												? `${c.durationInvoices} facture${c.durationInvoices > 1 ? "s" : ""}`
												: "toute la durée"}
										</span>
									</td>
									<td className={td}>{c.planKeys.length ? c.planKeys.map(planName).join(", ") : "Toutes"}</td>
									<td className={cn(td, "tabular-nums")}>
										{c.redemptions}
										{c.maxRedemptions !== null && ` / ${c.maxRedemptions}`}
									</td>
									<td className={td}>{c.validUntil ? formatDate(c.validUntil) : "Sans limite"}</td>
									<td className={td}>
										<Badge variant="outline" className={cn("border-transparent", STATE[c.state].tone)}>
											{STATE[c.state].label}
										</Badge>
									</td>
									{canWrite && (
										<td className={cn(td, "text-end")}>
											<PromoActiveSwitch id={c.id} code={c.code} active={c.active} />
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</FormCard>
		</>
	);
}
