"use client";

import { LuCheck, LuCopy, LuExternalLink, LuFileText, LuLoader, LuMail } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { formatDate, formatMad } from "@/lib/format";
import { cn } from "@/lib/utils";

/** GET /billing/summary (clinic-api), responsible doctor only. */
type BillingSummary = {
	plan: string | null;
	billingPeriod: "monthly" | "annual" | null;
	status: "trialing" | "active" | "past_due" | "cancelled" | null;
	trialEndsAt: string | null;
	currentPeriodEnd: string | null;
	nextAmount: number | null;
	openInvoice: { number: string; amount: number; dueAt: string; status: "billed" | "overdue" } | null;
	/** On trial, nothing invoiced yet: the doctor can ask for a devis. */
	canRequestQuote: boolean;
	planKey: string | null;
	pendingQuote: { id: string; number: string; amount: number; dueAt: string; description: string } | null;
	plans: Plan[];
	invoices: { id: string; number: string; amount: number; status: string; issuedAt: string }[];
	/** Where to send the proof of transfer; null = reply to the e-mail. */
	proofEmail: string | null;
	payTo: {
		companyName: string | null;
		accountHolder: string | null;
		bankName: string | null;
		rib: string;
		swift: string | null;
	} | null;
};

type Plan = {
	key: string;
	name: string;
	description: string | null;
	priceMonthly: number;
	priceAnnual: number;
	maxDoctors: number | null;
	maxSecretaries: number | null;
	storageQuotaMb: number | null;
};
type Period = "monthly" | "annual";

const PERIOD = { monthly: "mois", annual: "an" } as const;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const limits = (p: Plan) =>
	[
		p.maxDoctors === null ? "Médecins illimités" : plural(p.maxDoctors, "médecin"),
		p.maxSecretaries === null ? "secrétaires illimitées" : plural(p.maxSecretaries, "secrétaire"),
		p.storageQuotaMb !== null && `${Math.round(p.storageQuotaMb / 1024)} Go`,
	]
		.filter(Boolean)
		.join(" · ");

/** "000000000000000000000000" → "000 000 0000000000000000 00" (Moroccan RIB layout). */
const formatRib = (rib: string) =>
	rib.length === 24 ? `${rib.slice(0, 3)} ${rib.slice(3, 6)} ${rib.slice(6, 22)} ${rib.slice(22)}` : rib;

function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			size="icon"
			variant="ghost"
			className="size-7"
			aria-label={`Copier ${label}`}
			onClick={() =>
				navigator.clipboard
					.writeText(value)
					.then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 1500);
					})
					.catch(() => toast.error("Copie impossible : sélectionnez le texte."))
			}
		>
			{copied ? <LuCheck /> : <LuCopy />}
		</Button>
	);
}

/** The offers and the period; "Recevoir mon devis" sends it by e-mail at once. */
function OfferPicker({
	summary,
	onDone,
	onCancel,
}: {
	summary: BillingSummary;
	onDone: () => void;
	onCancel?: () => void;
}) {
	const [planKey, setPlanKey] = useState(summary.planKey ?? summary.plans[0]?.key ?? "");
	const [period, setPeriod] = useState<Period>(summary.billingPeriod ?? "monthly");
	const [saving, setSaving] = useState(false);

	const submit = async () => {
		setSaving(true);
		try {
			const quote = await api<{ number: string; delivery: "sent" | "logged" | "failed" }>("/billing/quote", {
				method: "POST",
				body: JSON.stringify({ planKey, billingPeriod: period }),
			});
			if (quote.delivery === "failed") {
				toast.warning(`Devis ${quote.number} créé, mais l’e-mail n’est pas parti : il reste disponible ici.`);
			} else {
				toast.success(`Devis ${quote.number} envoyé par e-mail`);
			}
			onDone();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Envoi du devis impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="grid gap-3">
			<div className="bg-muted flex gap-1 rounded-lg p-[3px]" role="radiogroup" aria-label="Période">
				{(["monthly", "annual"] as const).map((p) => (
					<button
						key={p}
						type="button"
						role="radio"
						aria-checked={period === p}
						onClick={() => setPeriod(p)}
						className={cn(
							"text-muted-foreground flex-1 rounded-md px-3 py-1",
							period === p && "bg-background text-foreground shadow-sm",
						)}
					>
						{p === "monthly" ? "Mensuel" : "Annuel"}
					</button>
				))}
			</div>
			<div className="grid gap-2" role="radiogroup" aria-label="Offre">
				{summary.plans.map((p) => (
					<button
						key={p.key}
						type="button"
						role="radio"
						aria-checked={planKey === p.key}
						onClick={() => setPlanKey(p.key)}
						className={cn(
							"hover:bg-muted/60 rounded-xl border p-3 text-start transition-colors",
							planKey === p.key && "border-primary ring-primary/30 ring-2",
						)}
					>
						<span className="flex items-baseline justify-between gap-2">
							<span className="font-semibold">{p.name}</span>
							<span className="font-semibold tabular-nums">
								{formatMad(period === "annual" ? p.priceAnnual : p.priceMonthly)}
								<span className="text-muted-foreground font-normal"> / {PERIOD[period]}</span>
							</span>
						</span>
						<span className="text-muted-foreground mt-0.5 block text-xs">{limits(p)}</span>
					</button>
				))}
			</div>
			<div className="flex gap-2">
				{onCancel && (
					<Button variant="outline" onClick={onCancel} disabled={saving}>
						Retour
					</Button>
				)}
				<Button className="flex-1" onClick={submit} disabled={saving || !planKey}>
					{saving && <LuLoader className="animate-spin" />} Recevoir mon devis
				</Button>
			</div>
		</div>
	);
}

/** Offer, the devis or invoice waiting, where to send the transfer, past factures. */
export function SubscriptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const router = useRouter();
	const [summary, setSummary] = useState<BillingSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [changing, setChanging] = useState(false);

	const load = useCallback(
		() =>
			api<BillingSummary>("/billing/summary")
				.then(setSummary)
				.catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible")),
		[],
	);

	useEffect(() => {
		if (open) void load();
	}, [open, load]);

	const s = summary;
	const quote = s?.pendingQuote;
	const invoice = s?.openInvoice;
	const reference = quote?.number ?? invoice?.number;
	const picking = s?.canRequestQuote && (!quote || changing);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{picking ? "Choisir mon offre" : "Votre abonnement"}</DialogTitle>
					<DialogDescription>
						{picking
							? "Vous recevez un devis par e-mail. Votre abonnement démarre à réception du paiement."
							: "Paiement par virement bancaire, facture envoyée par e-mail."}
					</DialogDescription>
				</DialogHeader>

				{!s && !error && (
					<p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
						<LuLoader className="size-4 animate-spin" /> Chargement…
					</p>
				)}
				{error && <p className="text-destructive py-4 text-sm">{error}</p>}

				{s && picking && (
					<div className="grid gap-4 text-sm">
						{s.status === "trialing" && s.trialEndsAt && (
							<p className="text-muted-foreground">
								Essai gratuit jusqu’au <span className="text-foreground">{formatDate(s.trialEndsAt)}</span>. Payer avant
								cette date ne vous fait perdre aucun jour d’essai.
							</p>
						)}
						<OfferPicker
							summary={s}
							onCancel={quote ? () => setChanging(false) : undefined}
							onDone={() => {
								setChanging(false);
								void load();
								router.refresh();
							}}
						/>
					</div>
				)}

				{s && !picking && (
					<div className="grid gap-4 text-sm">
						{!quote && (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground text-xs">Votre offre</p>
								<p className="mt-0.5 flex items-baseline justify-between gap-2">
									<span className="text-base font-semibold">{s.plan ? `Offre ${s.plan}` : "Aucune offre"}</span>
									{s.nextAmount !== null && s.billingPeriod && (
										<span className="font-semibold tabular-nums">
											{formatMad(s.nextAmount)}
											<span className="text-muted-foreground font-normal"> / {PERIOD[s.billingPeriod]}</span>
										</span>
									)}
								</p>
								{s.status === "active" && s.currentPeriodEnd && (
									<p className="text-muted-foreground mt-2">
										Actif jusqu’au <span className="text-foreground">{formatDate(s.currentPeriodEnd)}</span>.
									</p>
								)}
							</div>
						)}

						{quote && (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground text-xs">Devis à régler</p>
								<p className="mt-0.5 flex items-baseline justify-between gap-2">
									<span className="font-semibold">{quote.number}</span>
									<span className="font-semibold tabular-nums">{formatMad(quote.amount)}</span>
								</p>
								<p className="text-muted-foreground mt-1">{quote.description}</p>
								<p className="text-muted-foreground">À régler avant le {formatDate(quote.dueAt)}</p>
								<div className="mt-3 flex flex-wrap gap-2">
									<Button asChild size="sm" variant="outline">
										<a href={`/devis/${quote.id}`} target="_blank" rel="noreferrer">
											<LuExternalLink /> Voir le devis
										</a>
									</Button>
									<Button size="sm" variant="ghost" onClick={() => setChanging(true)}>
										Changer d’offre
									</Button>
								</div>
							</div>
						)}

						{invoice && (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground text-xs">
									{invoice.status === "overdue" ? "Facture en retard" : "Facture à régler"}
								</p>
								<p className="mt-0.5 flex items-baseline justify-between gap-2">
									<span className="font-semibold">{invoice.number}</span>
									<span className="font-semibold tabular-nums">{formatMad(invoice.amount)}</span>
								</p>
								<p className="text-muted-foreground mt-1">Échéance : {formatDate(invoice.dueAt)}</p>
							</div>
						)}

						{(quote || invoice) && s.payTo && (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground mb-2 text-xs">Virement à</p>
								<dl className="grid gap-1.5">
									{s.payTo.accountHolder && (
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">Titulaire</dt>
											<dd className="text-end">{s.payTo.accountHolder}</dd>
										</div>
									)}
									{s.payTo.bankName && (
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">Banque</dt>
											<dd className="text-end">{s.payTo.bankName}</dd>
										</div>
									)}
									<div className="flex items-center justify-between gap-3">
										<dt className="text-muted-foreground">RIB</dt>
										<dd className="flex items-center gap-1 font-mono text-xs">
											{formatRib(s.payTo.rib)}
											<CopyButton value={s.payTo.rib} label="le RIB" />
										</dd>
									</div>
									{reference && (
										<div className="flex items-center justify-between gap-3">
											<dt className="text-muted-foreground">Référence</dt>
											<dd className="flex items-center gap-1 font-mono text-xs">
												{reference}
												<CopyButton value={reference} label="la référence" />
											</dd>
										</div>
									)}
								</dl>
								{reference && (
									<p className="text-muted-foreground mt-2 text-xs">
										Indiquez la référence dans le libellé du virement : votre paiement est reconnu plus vite.
									</p>
								)}
							</div>
						)}
						{(quote || invoice) && !s.payTo && (
							<p className="text-muted-foreground text-xs">
								Les coordonnées bancaires figurent {quote ? "sur le devis" : "sur la facture"} reçu{quote ? "" : "e"} par
								e-mail.
							</p>
						)}

						{quote && (
							<p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs">
								Après le virement, envoyez votre <span className="text-foreground font-medium">avis de virement</span>{" "}
								{s.proofEmail ? (
									<>
										à{" "}
										<a className="text-foreground underline" href={`mailto:${s.proofEmail}?subject=${encodeURIComponent(`Paiement du devis ${quote.number}`)}`}>
											{s.proofEmail}
										</a>
									</>
								) : (
									"en réponse à l’e-mail du devis"
								)}
								. Nous créons votre facture et votre abonnement démarre.
							</p>
						)}

						{s.invoices.length > 0 && (
							<div>
								<p className="text-muted-foreground mb-1 text-xs">Mes factures</p>
								<ul className="divide-y rounded-xl border">
									{s.invoices.map((i) => (
										<li key={i.id}>
											<a
												href={`/factures/${i.id}`}
												target="_blank"
												rel="noreferrer"
												className="hover:bg-muted/60 flex items-center gap-2 px-3 py-2"
											>
												<LuFileText className="text-muted-foreground size-4" />
												<span className="flex-1 font-mono text-xs">{i.number}</span>
												<span className="text-muted-foreground text-xs">{formatDate(i.issuedAt)}</span>
												<span className="font-medium tabular-nums">{formatMad(i.amount)}</span>
											</a>
										</li>
									))}
								</ul>
							</div>
						)}

						{!s.canRequestQuote && (
							<Button asChild variant="outline" className="w-full">
								<a href="mailto:support@cabinova.ma?subject=Changer%20d%E2%80%99offre">
									<LuMail /> Changer d’offre ? Écrivez-nous
								</a>
							</Button>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
