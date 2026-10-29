"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	LuCircleCheck,
	LuLoader,
	LuLock,
	LuPlus,
	LuPrinter,
	LuReceipt,
	LuUndo2,
	LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { formatFileNumber } from "@/lib/patients";
import {
	type Account,
	type Act,
	mad,
	METHOD_LABELS,
	METHODS,
	type PaymentMethod,
	parseMad,
	toInput,
} from "@/lib/payments";
import { cn } from "@/lib/utils";

/** Queries a checkout refreshes (desk, patient file, visit). */
export const PAYMENT_KEYS = [["account"], ["desk"], ["patient-account"]] as const;

type Row = { key: number; actId: string | null; label: string; price: string; quantity: number };

let nextKey = 0;
const rowOf = (item: { actId: string | null; label: string; unitPrice: number; quantity: number }): Row => ({
	key: nextKey++,
	actId: item.actId,
	label: item.label,
	price: toInput(item.unitPrice),
	quantity: item.quantity,
});
const time = (iso: string) => formatDate(iso, { day: undefined, month: undefined, year: undefined, hour: "2-digit", minute: "2-digit" });

/**
 * Encaisser a visit: its acts (from the price list, prices adjustable),
 * what was already paid, and a payment now — then the receipt to print.
 */
export function CheckoutDialog({
	appointmentId,
	onOpenChange,
}: {
	/** null: closed. */
	appointmentId: string | null;
	onOpenChange: (open: boolean) => void;
}) {
	const user = useCurrentUser();
	return (
		<Dialog open={appointmentId !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
				{appointmentId && <Checkout key={appointmentId} appointmentId={appointmentId} user={user} onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function Checkout({
	appointmentId,
	user,
	onDone,
}: {
	appointmentId: string;
	user: { id: string; role: string };
	onDone: () => void;
}) {
	const account = useQuery({
		queryKey: ["account", appointmentId],
		queryFn: () => api<Account>(`/appointments/${appointmentId}/account`),
	});
	const acts = useQuery({ queryKey: ["acts"], queryFn: () => api<Act[]>("/acts") });

	if (!account.data || !acts.data) {
		return (
			<div className="grid gap-4">
				<DialogHeader>
					<DialogTitle>Encaisser</DialogTitle>
					<DialogDescription>Chargement de la visite…</DialogDescription>
				</DialogHeader>
				<Skeleton className="h-32" />
				{account.error && <p className="text-destructive text-sm">{account.error.message}</p>}
			</div>
		);
	}
	return <CheckoutForm account={account.data} acts={acts.data} user={user} onDone={onDone} />;
}

function CheckoutForm({
	account,
	acts,
	user,
	onDone,
}: {
	account: Account;
	acts: Act[];
	user: { id: string; role: string };
	onDone: () => void;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { appointment: visit } = account;
	const owner = user.role === "owner";
	const [rows, setRows] = useState<Row[]>(() => account.items.map(rowOf));
	const [amount, setAmount] = useState<string | null>(null);
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [reference, setReference] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [paid, setPaid] = useState<{ id: string; receiptNumber: string | null; amount: number } | null>(null);

	const prices = rows.map((r) => parseMad(r.price));
	const invalid = rows.some((r, i) => prices[i] === null || !r.label.trim());
	const total = rows.reduce((s, r, i) => s + (prices[i] ?? 0) * r.quantity, 0);
	const remaining = total - account.paid;
	// The amount follows the remaining balance until it's typed.
	const amountText = amount ?? (remaining > 0 ? toInput(remaining) : "");
	const amountValue = parseMad(amountText);
	const changed =
		JSON.stringify(rows.map((r, i) => [r.actId, r.label.trim(), prices[i], r.quantity])) !==
		JSON.stringify(account.items.map((i) => [i.actId, i.label, i.unitPrice, i.quantity]));

	const setRow = (key: number, change: Partial<Row>) =>
		setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
	const addAct = (act: Act) => {
		const existing = rows.find((r) => r.actId === act.id);
		if (existing) setRow(existing.key, { quantity: existing.quantity + 1 });
		else setRows((all) => [...all, rowOf({ actId: act.id, label: act.name, unitPrice: act.price, quantity: 1 })]);
	};

	const refresh = async () => {
		await Promise.all(PAYMENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
		router.refresh();
	};

	const save = async (withPayment: boolean) => {
		setError(null);
		if (rows.length === 0) return setError("Ajoutez au moins un acte.");
		if (invalid) return setError("Vérifiez les actes : chaque ligne a un libellé et un prix.");
		if (withPayment && (amountValue === null || amountValue <= 0)) return setError("Montant invalide.");
		if (withPayment && amountValue! > remaining) return setError(`Le montant dépasse le reste à payer (${mad(remaining)}).`);
		setSaving(true);
		try {
			const res = await api<Account & { paymentId: string | null }>(`/appointments/${visit.id}/checkout`, {
				method: "POST",
				body: JSON.stringify({
					items: rows.map((r, i) => ({
						actId: r.actId ?? undefined,
						label: r.label.trim(),
						unitPrice: prices[i],
						quantity: r.quantity,
					})),
					...(withPayment && {
						payment: { amount: amountValue, method, reference: reference.trim() || undefined },
					}),
				}),
			});
			queryClient.setQueryData(["account", visit.id], res);
			await refresh();
			if (res.paymentId) {
				const payment = res.payments.find((p) => p.id === res.paymentId)!;
				setPaid({ id: payment.id, receiptNumber: payment.receiptNumber, amount: payment.amount });
			} else {
				toast.success("Actes enregistrés");
				onDone();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	const patientName = `${visit.patient.firstName} ${visit.patient.lastName}`;

	if (paid) {
		return (
			<div className="grid gap-5">
				<DialogHeader>
					<DialogTitle className="sr-only">Paiement enregistré</DialogTitle>
					<DialogDescription className="sr-only">Le reçu est prêt à imprimer.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col items-center gap-2 py-4 text-center">
					<span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
						<LuCircleCheck className="size-6" />
					</span>
					<p className="text-lg font-semibold">{mad(paid.amount)} encaissés</p>
					<p className="text-muted-foreground text-sm">
						{patientName} · reçu <span className="font-mono">{paid.receiptNumber}</span>
						{account.balance > 0 ? ` · reste ${mad(account.balance)}` : " · visite réglée"}
					</p>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onDone}>
						Terminé
					</Button>
					<Button asChild>
						<a href={`/receipts/${paid.id}`} target="_blank" rel="noopener">
							<LuPrinter /> Imprimer le reçu
						</a>
					</Button>
				</DialogFooter>
			</div>
		);
	}

	const locked = account.dayClosed;
	const methodInfo = METHODS.find((m) => m.value === method)!;
	const suggestions = acts.filter((a) => !rows.some((r) => r.actId === a.id)).slice(0, 8);

	return (
		<div className="grid gap-5">
			<DialogHeader>
				<DialogTitle>Encaisser · {patientName}</DialogTitle>
				<DialogDescription>
					<span className="first-letter:uppercase">
						{formatDate(visit.startsAt, { weekday: "long", year: undefined, hour: "2-digit", minute: "2-digit" })}
					</span>{" "}
					· {visit.practitioner.name} · {formatFileNumber(visit.patient.fileNumber)}
				</DialogDescription>
			</DialogHeader>

			{locked && (
				<p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
					<LuLock className="mt-0.5 size-4 shrink-0" />
					La caisse du jour est clôturée : plus aucun paiement aujourd’hui dans cet espace.
				</p>
			)}

			<section className="grid gap-2">
				<h3 className="text-sm font-medium">Actes</h3>
				{rows.length > 0 && (
					<ul className="grid gap-2">
						{rows.map((r, i) => (
							<li key={r.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem_2rem] items-center gap-2">
								<Input
									value={r.label}
									aria-label="Libellé"
									maxLength={120}
									onChange={(e) => setRow(r.key, { label: e.target.value })}
									className="h-9"
								/>
								<Input
									type="number"
									min={1}
									max={99}
									value={r.quantity}
									aria-label="Quantité"
									onChange={(e) => setRow(r.key, { quantity: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
									className="h-9 text-center tabular-nums"
								/>
								<div className="relative">
									<Input
										inputMode="decimal"
										value={r.price}
										aria-label="Prix unitaire en MAD"
										aria-invalid={prices[i] === null}
										onChange={(e) => setRow(r.key, { price: e.target.value })}
										className="h-9 pe-10 text-end tabular-nums"
									/>
									<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs">
										MAD
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="text-muted-foreground size-8"
									aria-label={`Retirer ${r.label}`}
									onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
								>
									<LuX />
								</Button>
							</li>
						))}
					</ul>
				)}
				<div className="flex flex-wrap gap-1.5">
					{suggestions.map((a) => (
						<Button key={a.id} type="button" variant="outline" size="sm" className="h-7 font-normal" onClick={() => addAct(a)}>
							<LuPlus /> {a.name} <span className="text-muted-foreground tabular-nums">{mad(a.price)}</span>
						</Button>
					))}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-muted-foreground h-7 font-normal"
						onClick={() => setRows((all) => [...all, rowOf({ actId: null, label: "", unitPrice: 0, quantity: 1 })])}
					>
						<LuPlus /> Ligne libre
					</Button>
				</div>
				{acts.length === 0 && (
					<p className="text-muted-foreground text-xs">
						{owner ? "Ajoutez vos tarifs dans Paramètres › Tarifs pour les retrouver ici." : "Aucun tarif enregistré : saisissez une ligne libre."}
					</p>
				)}
			</section>

			<dl className="bg-muted/50 grid gap-1.5 rounded-lg p-3 text-sm">
				<div className="flex justify-between">
					<dt className="text-muted-foreground">Total</dt>
					<dd className="font-medium tabular-nums">{mad(total)}</dd>
				</div>
				{account.paid !== 0 && (
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Déjà payé</dt>
						<dd className="tabular-nums">{mad(account.paid)}</dd>
					</div>
				)}
				<div className="flex justify-between border-t pt-1.5">
					<dt className="font-medium">{remaining < 0 ? "Trop-perçu (à rembourser)" : "Reste à payer"}</dt>
					<dd className="font-semibold tabular-nums">{mad(Math.abs(remaining))}</dd>
				</div>
			</dl>

			{account.payments.length > 0 && (
				<Movements
					account={account}
					user={user}
					onChange={async (next) => {
						queryClient.setQueryData(["account", visit.id], next);
						await refresh();
					}}
				/>
			)}

			{!locked && remaining > 0 && (
				<section className="grid gap-3">
					<h3 className="text-sm font-medium">Paiement</h3>
					<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mode de paiement">
						{METHODS.map((m) => (
							<button
								key={m.value}
								type="button"
								role="radio"
								aria-checked={method === m.value}
								onClick={() => setMethod(m.value)}
								className={cn(
									"h-8 rounded-lg border px-3 text-sm transition-colors",
									method === m.value
										? "border-primary bg-primary text-primary-foreground font-medium"
										: "bg-background text-muted-foreground hover:text-foreground",
								)}
							>
								{m.label}
							</button>
						))}
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="relative">
							<Input
								inputMode="decimal"
								value={amountText}
								aria-label="Montant reçu en MAD"
								aria-invalid={amountText !== "" && amountValue === null}
								onChange={(e) => setAmount(e.target.value)}
								className="pe-12 text-end text-base font-medium tabular-nums"
							/>
							<span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm">
								MAD
							</span>
						</div>
						{methodInfo.reference && (
							<Input
								value={reference}
								maxLength={80}
								placeholder={`${methodInfo.reference} (facultatif)`}
								onChange={(e) => setReference(e.target.value)}
							/>
						)}
					</div>
					{amountValue !== null && amountValue < remaining && amountValue > 0 && (
						<p className="text-muted-foreground text-xs">Paiement partiel : il restera {mad(remaining - amountValue)} à payer.</p>
					)}
				</section>
			)}

			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}

			<DialogFooter className="gap-2">
				{!locked && remaining > 0 ? (
					<>
						<Button type="button" variant="outline" disabled={saving || !changed} onClick={() => save(false)}>
							Enregistrer sans encaisser
						</Button>
						<Button type="button" disabled={saving} onClick={() => save(true)}>
							{saving ? <LuLoader className="animate-spin" /> : <LuReceipt />} Encaisser{" "}
							{amountValue ? mad(amountValue) : ""}
						</Button>
					</>
				) : (
					<>
						<Button type="button" variant="outline" onClick={onDone}>
							Fermer
						</Button>
						{changed && (
							<Button type="button" disabled={saving} onClick={() => save(false)}>
								{saving && <LuLoader className="animate-spin" />} Enregistrer les actes
							</Button>
						)}
					</>
				)}
			</DialogFooter>
		</div>
	);
}

/** What was received or given back for the visit; cancel a mistake, refund (owner). */
function Movements({
	account,
	user,
	onChange,
}: {
	account: Account;
	user: { id: string; role: string };
	onChange: (account: Account) => Promise<void>;
}) {
	const [cancelling, setCancelling] = useState<string | null>(null);
	const [refunding, setRefunding] = useState(false);
	const owner = user.role === "owner";
	const canRefund = owner && !account.dayClosed && account.paid > 0 && account.chargeId;

	return (
		<section className="grid gap-2">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium">Paiements</h3>
				{canRefund && !refunding && (
					<Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setRefunding(true)}>
						<LuUndo2 /> Rembourser
					</Button>
				)}
			</div>
			<ul className="divide-y rounded-lg border text-sm">
				{account.payments.map((p) => (
					<li key={p.id} className="grid gap-2 px-3 py-2">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span className={cn("font-medium tabular-nums", p.cancelledAt && "text-muted-foreground line-through")}>
								{p.kind === "refund" ? "−" : ""}
								{mad(p.amount)}
							</span>
							<span className="text-muted-foreground">
								{p.kind === "refund" ? "Remboursement" : METHOD_LABELS[p.method]}
								{p.kind === "refund" && ` (${METHOD_LABELS[p.method].toLowerCase()})`}
								{p.reference && ` · ${p.reference}`} · {time(p.receivedAt)}
								{p.receivedBy && ` · ${p.receivedBy}`}
							</span>
							{p.cancelledAt && (
								<Badge variant="outline" className="font-normal">
									Annulé
								</Badge>
							)}
							<span className="ms-auto flex items-center gap-1">
								{p.receiptNumber && !p.cancelledAt && (
									<Button asChild variant="ghost" size="sm" className="h-7 font-mono text-xs">
										<a href={`/receipts/${p.id}`} target="_blank" rel="noopener" title="Imprimer le reçu">
											<LuPrinter /> {p.receiptNumber}
										</a>
									</Button>
								)}
								{!p.cancelledAt && !p.locked && (owner || p.receivedById === user.id) && cancelling !== p.id && (
									<Button type="button" variant="ghost" size="sm" className="text-muted-foreground h-7" onClick={() => setCancelling(p.id)}>
										Annuler
									</Button>
								)}
							</span>
						</div>
						{(p.cancelReason || p.reason) && (
							<p className="text-muted-foreground text-xs">
								{p.cancelledAt ? `Annulé${p.cancelledBy ? ` par ${p.cancelledBy}` : ""} : ${p.cancelReason}` : `Motif : ${p.reason}`}
							</p>
						)}
						{cancelling === p.id && (
							<ReasonForm
								label="Raison de l’annulation"
								action="Annuler le paiement"
								onCancel={() => setCancelling(null)}
								onSubmit={async (reason) => {
									const next = await api<Account>(`/payments/${p.id}/cancel`, {
										method: "POST",
										body: JSON.stringify({ reason }),
									});
									setCancelling(null);
									toast.success("Paiement annulé");
									await onChange(next);
								}}
							/>
						)}
					</li>
				))}
			</ul>
			{refunding && account.chargeId && (
				<RefundForm
					chargeId={account.chargeId}
					max={account.paid}
					suggested={account.balance < 0 ? -account.balance : account.paid}
					onCancel={() => setRefunding(false)}
					onDone={async (next) => {
						setRefunding(false);
						toast.success("Remboursement enregistré");
						await onChange(next);
					}}
				/>
			)}
		</section>
	);
}

function ReasonForm({
	label,
	action,
	onSubmit,
	onCancel,
}: {
	label: string;
	action: string;
	onSubmit: (reason: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	return (
		<form
			className="flex flex-wrap gap-2"
			onSubmit={async (e) => {
				e.preventDefault();
				if (reason.trim().length < 3) return toast.error("Indiquez la raison (3 caractères minimum).");
				setPending(true);
				try {
					await onSubmit(reason.trim());
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Action impossible");
				} finally {
					setPending(false);
				}
			}}
		>
			<Input autoFocus value={reason} maxLength={300} placeholder={label} aria-label={label} onChange={(e) => setReason(e.target.value)} className="h-8 min-w-48 flex-1" />
			<Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel}>
				Retour
			</Button>
			<Button type="submit" variant="destructive" size="sm" className="h-8" disabled={pending}>
				{pending && <LuLoader className="animate-spin" />} {action}
			</Button>
		</form>
	);
}

function RefundForm({
	chargeId,
	max,
	suggested,
	onCancel,
	onDone,
}: {
	chargeId: string;
	max: number;
	suggested: number;
	onCancel: () => void;
	onDone: (account: Account) => Promise<void>;
}) {
	const [amount, setAmount] = useState(toInput(Math.min(max, suggested)));
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const value = parseMad(amount);

	return (
		<form
			className="bg-muted/40 grid gap-2 rounded-lg border p-3"
			onSubmit={async (e) => {
				e.preventDefault();
				if (value === null || value <= 0 || value > max) return toast.error(`Montant entre 0 et ${mad(max)}.`);
				if (reason.trim().length < 3) return toast.error("Indiquez la raison (3 caractères minimum).");
				setPending(true);
				try {
					await onDone(
						await api<Account>(`/charges/${chargeId}/refunds`, {
							method: "POST",
							body: JSON.stringify({ amount: value, method, reason: reason.trim() }),
						}),
					);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Remboursement impossible");
				} finally {
					setPending(false);
				}
			}}
		>
			<p className="text-sm font-medium">Rembourser le patient</p>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="relative">
					<Input inputMode="decimal" value={amount} aria-label="Montant remboursé en MAD" onChange={(e) => setAmount(e.target.value)} className="h-8 pe-12 text-end tabular-nums" />
					<span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs">MAD</span>
				</div>
				<Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
					<SelectTrigger size="sm" aria-label="Mode de remboursement" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{METHODS.map((m) => (
							<SelectItem key={m.value} value={m.value}>
								{m.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<Input value={reason} maxLength={300} placeholder="Raison du remboursement" aria-label="Raison du remboursement" onChange={(e) => setReason(e.target.value)} className="h-8" />
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					Retour
				</Button>
				<Button type="submit" size="sm" disabled={pending}>
					{pending && <LuLoader className="animate-spin" />} Rembourser {value ? mad(value) : ""}
				</Button>
			</div>
		</form>
	);
}

