"use client";

import { LuFileText, LuRefreshCw, LuTicketPercent, LuX } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { CREDIT_NOTE_KIND_LABELS, type TenantBilling } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { BILLING_PERIOD_LABELS, type BillingPeriod, formatPrice, type Plan } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";
import { InvoicesTable } from "../../../billing/_components/invoices-table";
import { QuotesTable } from "../../../billing/_components/quotes-table";

const STATUS_TONES = {
	trialing: "bg-sky-50 text-sky-700",
	active: "bg-emerald-50 text-emerald-700",
	past_due: "bg-amber-50 text-amber-800",
	cancelled: "bg-zinc-100 text-zinc-600",
} as const;

type Form = { planKey: string; billingPeriod: BillingPeriod; discountPercent: string; applyQuotas: boolean; trialDays: string };

/**
 * Module 3 on the cabinet page: the subscription (plan, price, paid-until
 * date), its invoices, and the actions — change plan, attach a plan,
 * résiliation at term, send a devis or issue the next invoice now.
 */
export function TenantSubscription({
	tenantId,
	billing,
	plans,
	canManage,
	canBill,
	closed,
}: {
	tenantId: string;
	billing: TenantBilling;
	plans: Plan[];
	/** subscriptions:write */
	canManage: boolean;
	/** billing:write */
	canBill: boolean;
	closed: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const sub = billing.subscription;
	const [dialog, setDialog] = useState<"change" | "attach" | null>(null);
	const [promoInput, setPromoInput] = useState("");
	const promo = billing.promo;
	const [form, setForm] = useState<Form>({
		planKey: sub?.plan.key ?? plans[0]?.key ?? "",
		billingPeriod: sub?.billingPeriod ?? "monthly",
		discountPercent: String(sub?.discountPercent ?? 0),
		applyQuotas: !sub,
		trialDays: String(plans.find((p) => p.key === (sub?.plan.key ?? plans[0]?.key))?.trialDays ?? 0),
	});
	const plan = plans.find((p) => p.key === form.planKey);
	const discount = Math.min(100, Math.max(0, Number(form.discountPercent) || 0));
	const price = plan ? (form.billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly) : 0;
	const preview = Math.round((price * (100 - discount)) / 100);

	const run = (fn: () => Promise<unknown>, success: string) =>
		startTransition(async () => {
			try {
				await fn();
				toast.success(success);
				setDialog(null);
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Action impossible");
			}
		});

	const submit = () => {
		const body = {
			planKey: form.planKey,
			billingPeriod: form.billingPeriod,
			discountPercent: discount,
			applyQuotas: form.applyQuotas,
			...(dialog === "attach" && { trialDays: Number(form.trialDays) || 0 }),
		};
		run(
			() =>
				api(`/tenants/${tenantId}/subscription`, {
					method: dialog === "attach" ? "POST" : "PATCH",
					body: JSON.stringify(body),
				}),
			dialog === "attach" ? "Offre associée" : "Abonnement modifié",
		);
	};

	const row = (label: string, value: React.ReactNode) => (
		<div className="grid grid-cols-[150px_1fr] gap-4 py-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0">{value}</dd>
		</div>
	);

	return (
		<div className="grid gap-3">
			{sub ? (
				<FormCard
					title={
						<span className="flex items-center gap-2">
							Abonnement {sub.plan.name}
							<Badge variant="outline" className={cn("border-transparent", STATUS_TONES[sub.status])}>
								{SUBSCRIPTION_STATUS_LABELS[sub.status]}
							</Badge>
						</span>
					}
					action={
						<div className="flex flex-wrap gap-2">
							{canBill && billing.quoteable && !billing.quotes.some((q) => q.status === "pending") && (
								<Button
									size="sm"
									variant="outline"
									disabled={pending}
									onClick={() => run(() => api(`/tenants/${tenantId}/billing/quotes`, { method: "POST" }), "Devis envoyé")}
								>
									<LuFileText /> Envoyer un devis
								</Button>
							)}
							{canBill && !billing.quoteable && (
								<Button
									size="sm"
									variant="outline"
									disabled={pending}
									onClick={() =>
										run(() => api(`/tenants/${tenantId}/billing/invoices`, { method: "POST" }), "Facture émise et envoyée")
									}
								>
									<LuFileText /> Émettre la facture
								</Button>
							)}
							{canManage && (
								<Button size="sm" variant="outline" onClick={() => setDialog("change")}>
									<LuRefreshCw /> Changer d’offre
								</Button>
							)}
						</div>
					}
				>
					<div className="grid gap-x-8 lg:grid-cols-2">
						<dl className="divide-y">
							{row("Facturation", `${BILLING_PERIOD_LABELS[sub.billingPeriod]} — ${formatPrice(sub.price)}`)}
							{row("Remise", sub.discountPercent ? `${sub.discountPercent} %` : "Aucune")}
							{row(
								"Code promo",
								promo ? (
									<span className="flex flex-wrap items-center gap-2">
										<Badge variant="outline" className="border-transparent bg-violet-50 font-mono text-violet-700">
											<LuTicketPercent /> {promo.code}
										</Badge>
										<span className="text-xs text-muted-foreground">
											−{promo.discountPercent} %
											{promo.invoicesLeft === null
												? ", toute la durée"
												: promo.invoicesLeft > 0
													? `, encore ${promo.invoicesLeft} facture${promo.invoicesLeft > 1 ? "s" : ""}`
													: ", terminé"}
											{promo.discountPercent <= sub.discountPercent && " (remise actuelle plus avantageuse)"}
										</span>
										{canManage && (
											<Button
												size="icon-sm"
												variant="ghost"
												aria-label="Retirer le code"
												disabled={pending}
												onClick={() => run(() => api(`/tenants/${tenantId}/promo-code`, { method: "DELETE" }), "Code promo retiré")}
											>
												<LuX />
											</Button>
										)}
									</span>
								) : canManage ? (
									<form
										className="flex min-w-0 flex-wrap gap-2"
										onSubmit={(e) => {
											e.preventDefault();
											if (!promoInput.trim()) return;
											run(
												() =>
													api(`/tenants/${tenantId}/promo-code`, {
														method: "POST",
														body: JSON.stringify({ code: promoInput }),
													}).then(() => setPromoInput("")),
												"Code promo appliqué aux prochaines factures",
											);
										}}
									>
										<Input
											value={promoInput}
											onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
											placeholder="CODE"
											className="h-8 w-32 font-mono"
											aria-label="Code promo"
										/>
										<Button size="sm" variant="outline" disabled={pending || !promoInput.trim()}>
											Appliquer
										</Button>
									</form>
								) : (
									"Aucun"
								),
							)}
							{billing.creditBalance > 0 &&
								row("Crédit (avoirs)", <span className="text-emerald-700">{formatPrice(billing.creditBalance)} à déduire</span>)}
							{row(
								"Prochaine facture",
								<span className="font-medium">
									{formatPrice(sub.nextAmount)}
									{sub.nextAmount !== sub.listAmount && (
										<span className="ms-1.5 text-xs font-normal text-muted-foreground line-through">{formatPrice(sub.listAmount)}</span>
									)}
								</span>,
							)}
						</dl>
						<dl className="divide-y">
							{row("Depuis le", formatDate(sub.startedAt))}
							{row(
								sub.status === "trialing" ? "Fin de l’essai" : "Payé jusqu’au",
								sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—",
							)}
							{row(
								"Résilier à l’échéance",
								<span className="flex items-center gap-2">
									<Switch
										checked={sub.cancelAtPeriodEnd}
										disabled={!canManage || pending}
										aria-label="Résilier à l’échéance"
										onCheckedChange={(v) =>
											run(
												() =>
													api(`/tenants/${tenantId}/subscription/cancel-at-term`, {
														method: "PUT",
														body: JSON.stringify({ cancelAtPeriodEnd: v }),
													}),
												v ? "Résiliation programmée à l’échéance" : "Résiliation annulée",
											)
										}
									/>
									<span className="text-xs text-muted-foreground">
										{sub.cancelAtPeriodEnd ? "Aucune nouvelle facture ; fin à l’échéance." : "Renouvellement automatique"}
									</span>
								</span>,
							)}
						</dl>
					</div>
					{sub.status === "past_due" && (
						<p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
							Une facture attend son virement. Enregistrez-le ci-dessous dès qu’il apparaît sur votre relevé.{" "}
							{billing.suspendAfterDays
								? `Sans paiement, le cabinet est suspendu automatiquement ${billing.suspendAfterDays} jours après l’échéance (prévenu 3 jours avant), puis réactivé dès le virement enregistré.`
								: "Le cabinet n’est pas suspendu automatiquement (réglage dans Paiements)."}
						</p>
					)}
				</FormCard>
			) : (
				<FormCard title="Abonnement">
					<div className="flex flex-wrap items-center justify-between gap-3 text-sm">
						<p className="text-muted-foreground">
							{closed ? "Cabinet fermé : plus d’abonnement." : "Ce cabinet n’a pas d’abonnement en cours."}
						</p>
						{canManage && !closed && (
							<Button size="sm" onClick={() => setDialog("attach")}>
								Associer une offre
							</Button>
						)}
					</div>
				</FormCard>
			)}

			{billing.quotes.length > 0 && (
				<FormCard title="Devis" contentClassName="p-0">
					<QuotesTable quotes={billing.quotes} canWrite={canBill} showTenant={false} />
				</FormCard>
			)}

			<FormCard title="Factures" contentClassName="p-0">
				<InvoicesTable invoices={billing.invoices} canWrite={canBill} showTenant={false} />
			</FormCard>

			{billing.creditNotes.length > 0 && (
				<FormCard title="Avoirs" contentClassName="p-0">
					<ul className="divide-y text-sm">
						{billing.creditNotes.map((n) => (
							<li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
								<span className="grid leading-tight">
									<span className="font-mono text-xs">{n.number}</span>
									<span className="text-xs text-muted-foreground">sur {n.invoiceNumber}</span>
								</span>
								<span className="grid min-w-0 flex-1 leading-tight">
									<span>{CREDIT_NOTE_KIND_LABELS[n.kind]}</span>
									<span className="truncate text-xs text-muted-foreground">
										{n.reason} · {formatDate(n.createdAt)}
										{n.issuedBy && ` · ${n.issuedBy}`}
									</span>
								</span>
								<span className="grid text-end leading-tight">
									<span className="font-medium tabular-nums">{formatPrice(n.amount)}</span>
									<span className="text-xs text-muted-foreground">
										{n.kind === "refund"
											? n.refundedAt
												? `remboursé le ${formatDate(n.refundedAt)}`
												: "remboursé"
											: n.remaining > 0
												? `${formatPrice(n.remaining)} restant`
												: "entièrement déduit"}
									</span>
								</span>
							</li>
						))}
					</ul>
				</FormCard>
			)}

			<Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{dialog === "attach" ? "Associer une offre" : "Changer d’offre"}</DialogTitle>
						<DialogDescription>
							{dialog === "attach"
								? "Avec un essai, la première facture part à la fin de l’essai ; sans essai, elle est émise maintenant."
								: "Prend effet à la prochaine facture ; les factures déjà émises ne changent pas."}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="sub-plan">Offre</FieldLabel>
								<Select
									value={form.planKey}
									onValueChange={(v) =>
										setForm((f) => ({ ...f, planKey: v, trialDays: String(plans.find((p) => p.key === v)?.trialDays ?? 0) }))
									}
								>
									<SelectTrigger id="sub-plan" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{plans.map((p) => (
											<SelectItem key={p.key} value={p.key}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor="sub-period">Facturation</FieldLabel>
								<Select value={form.billingPeriod} onValueChange={(v) => setForm((f) => ({ ...f, billingPeriod: v as BillingPeriod }))}>
									<SelectTrigger id="sub-period" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="monthly">Mensuel</SelectItem>
										<SelectItem value="annual">Annuel</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="sub-discount">Remise (%)</FieldLabel>
								<Input
									id="sub-discount"
									inputMode="numeric"
									value={form.discountPercent}
									onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
								/>
							</Field>
							{dialog === "attach" && (
								<Field>
									<FieldLabel htmlFor="sub-trial">Essai (jours)</FieldLabel>
									<Input
										id="sub-trial"
										inputMode="numeric"
										value={form.trialDays}
										onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
									/>
								</Field>
							)}
						</div>
						<Field orientation="horizontal">
							<Checkbox
								id="sub-quotas"
								checked={form.applyQuotas}
								onCheckedChange={(v) => setForm((f) => ({ ...f, applyQuotas: v === true }))}
							/>
							<FieldLabel htmlFor="sub-quotas" className="font-normal">
								Appliquer les limites de l’offre aux quotas du cabinet
							</FieldLabel>
						</Field>
						<FieldDescription className="rounded-md bg-muted px-3 py-2">
							Montant par {form.billingPeriod === "annual" ? "an" : "mois"} :{" "}
							<span className="font-medium text-foreground">{formatPrice(preview)}</span>
							{discount > 0 && ` (au lieu de ${formatPrice(price)})`}
						</FieldDescription>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialog(null)}>
							Annuler
						</Button>
						<Button onClick={submit} disabled={pending || !form.planKey}>
							{dialog === "attach" ? "Associer" : "Enregistrer"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
