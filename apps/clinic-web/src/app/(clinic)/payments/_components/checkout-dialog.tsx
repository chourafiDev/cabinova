"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useState } from "react";
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
import { formatFileNumber } from "@/lib/patients";
import {
	type Account,
	type Act,
	METHODS,
	type PaymentMethod,
	parseMad,
	toInput,
} from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
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

/**
 * The same checkout, laid out in the page instead of a dialog (the
 * dossier's Prix tab). After a payment or a save it starts over on the
 * visit's updated account.
 */
export function CheckoutPanel({ appointmentId }: { appointmentId: string }) {
	const user = useCurrentUser();
	const [round, setRound] = useState(0);
	return (
		<Inline value>
			<Checkout key={`${appointmentId}-${round}`} appointmentId={appointmentId} user={user} onDone={() => setRound((r) => r + 1)} />
		</Inline>
	);
}

/** In the page rather than a dialog: plain title and footer, nothing to close. */
const Inline = createContext(false);

function Head({ children }: { children: React.ReactNode }) {
	return useContext(Inline) ? <div className="grid gap-1.5">{children}</div> : <DialogHeader>{children}</DialogHeader>;
}

function Title({ className, children }: { className?: string; children: React.ReactNode }) {
	return useContext(Inline) ? (
		<h2 className={cn("font-heading text-lg leading-snug font-semibold tracking-tight", className)}>{children}</h2>
	) : (
		<DialogTitle className={className}>{children}</DialogTitle>
	);
}

function Description({ className, children }: { className?: string; children: React.ReactNode }) {
	return useContext(Inline) ? (
		<p className={cn("text-muted-foreground text-sm", className)}>{children}</p>
	) : (
		<DialogDescription className={className}>{children}</DialogDescription>
	);
}

function Footer({ className, children }: { className?: string; children: React.ReactNode }) {
	return useContext(Inline) ? (
		<div className={cn("flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end", className)}>{children}</div>
	) : (
		<DialogFooter className={className}>{children}</DialogFooter>
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
	const t = useTranslations("payments.checkout");

	if (!account.data || !acts.data) {
		return (
			<div className="grid gap-4">
				<Head>
					<Title>{t("title")}</Title>
					<Description>{t("loading")}</Description>
				</Head>
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
	const inline = useContext(Inline);
	const { appointment: visit } = account;
	const owner = user.role === "owner";
	const [rows, setRows] = useState<Row[]>(() => account.items.map(rowOf));
	const [amount, setAmount] = useState<string | null>(null);
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [reference, setReference] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [paid, setPaid] = useState<{ id: string; receiptNumber: string | null; amount: number } | null>(null);
	const t = useTranslations("payments.checkout");
	const payments = useTranslations("payments");
	const format = useFormat();
	const { mad } = format;

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
		if (rows.length === 0) return setError(t("addAct"));
		if (invalid) return setError(t("checkActs"));
		if (withPayment && (amountValue === null || amountValue <= 0)) return setError(t("invalidAmount"));
		if (withPayment && amountValue! > remaining) return setError(t("tooMuch", { amount: mad(remaining) }));
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
				toast.success(t("actsSaved"));
				onDone();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	const patientName = `${visit.patient.firstName} ${visit.patient.lastName}`;

	if (paid) {
		return (
			<div className="grid gap-5">
				<Head>
					<Title className="sr-only">{t("paidTitle")}</Title>
					<Description className="sr-only">{t("receiptReady")}</Description>
				</Head>
				<div className="flex flex-col items-center gap-2 py-4 text-center">
					<span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
						<LuCircleCheck className="size-6" />
					</span>
					<p className="text-lg font-semibold">{t("received", { amount: mad(paid.amount) })}</p>
					<p className="text-muted-foreground text-sm">
						{patientName} · {t("receipt")} <span className="font-mono">{paid.receiptNumber}</span>
						{account.balance > 0 ? ` · ${t("remaining", { amount: mad(account.balance) })}` : ` · ${t("settled")}`}
					</p>
				</div>
				<Footer>
					<Button variant="outline" onClick={onDone}>
						{t("finish")}
					</Button>
					<Button asChild>
						<a href={`/receipts/${paid.id}`} target="_blank" rel="noopener">
							<LuPrinter /> {t("print")}
						</a>
					</Button>
				</Footer>
			</div>
		);
	}

	const locked = account.dayClosed;
	const methodInfo = METHODS.find((m) => m.value === method)!;
	const suggestions = acts.filter((a) => !rows.some((r) => r.actId === a.id)).slice(0, 8);

	return (
		<div className="grid gap-5">
			<Head>
				<Title>{t("titleFor", { name: patientName })}</Title>
				<Description>
					<span className="first-letter:uppercase">
						{format.date(visit.startsAt, { weekday: "long", year: undefined, hour: "2-digit", minute: "2-digit" })}
					</span>{" "}
					· {visit.practitioner.name} · {formatFileNumber(visit.patient.fileNumber)}
				</Description>
			</Head>

			{locked && (
				<p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
					<LuLock className="mt-0.5 size-4 shrink-0" />
					{t("locked")}
				</p>
			)}

			<section className="grid gap-2">
				<h3 className="text-sm font-medium">{t("acts")}</h3>
				{rows.length > 0 && (
					<ul className="grid gap-2">
						{rows.map((r, i) => (
							<li key={r.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem_2rem] items-center gap-2">
								<Input
									value={r.label}
									aria-label={t("label")}
									maxLength={120}
									onChange={(e) => setRow(r.key, { label: e.target.value })}
									className="h-9"
								/>
								<Input
									type="number"
									min={1}
									max={99}
									value={r.quantity}
									aria-label={t("quantity")}
									onChange={(e) => setRow(r.key, { quantity: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
									className="h-9 text-center tabular-nums"
								/>
								<div className="relative">
									<Input
										inputMode="decimal"
										value={r.price}
										aria-label={t("unitPrice")}
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
									aria-label={t("remove", { label: r.label })}
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
						<LuPlus /> {t("freeLine")}
					</Button>
				</div>
				{acts.length === 0 && (
					<p className="text-muted-foreground text-xs">
						{owner ? t("noActsOwner") : t("noActs")}
					</p>
				)}
			</section>

			<dl className="bg-muted/50 grid gap-1.5 rounded-lg p-3 text-sm">
				<div className="flex justify-between">
					<dt className="text-muted-foreground">{t("total")}</dt>
					<dd className="font-medium tabular-nums">{mad(total)}</dd>
				</div>
				{account.paid !== 0 && (
					<div className="flex justify-between">
						<dt className="text-muted-foreground">{t("alreadyPaid")}</dt>
						<dd className="tabular-nums">{mad(account.paid)}</dd>
					</div>
				)}
				<div className="flex justify-between border-t pt-1.5">
					<dt className="font-medium">{remaining < 0 ? t("overpaid") : t("due")}</dt>
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
					<h3 className="text-sm font-medium">{t("payment")}</h3>
					<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={payments("methods.label")}>
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
								{payments(`methods.${m.value}`)}
							</button>
						))}
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="relative">
							<Input
								inputMode="decimal"
								value={amountText}
								aria-label={t("amountReceived")}
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
								placeholder={payments("references.optional", { label: payments(`references.${method as "card"}`) })}
								onChange={(e) => setReference(e.target.value)}
							/>
						)}
					</div>
					{amountValue !== null && amountValue < remaining && amountValue > 0 && (
						<p className="text-muted-foreground text-xs">{t("partial", { amount: mad(remaining - amountValue) })}</p>
					)}
				</section>
			)}

			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}

			{/* In the page there is nothing to close: no footer when nothing is left to do. */}
			{(!inline || (!locked && remaining > 0) || changed) && (
				<Footer className="gap-2">
					{!locked && remaining > 0 ? (
						<>
							<Button type="button" variant="outline" disabled={saving || !changed} onClick={() => save(false)}>
								{t("saveOnly")}
							</Button>
							<Button type="button" disabled={saving} onClick={() => save(true)}>
								{saving ? <LuLoader className="animate-spin" /> : <LuReceipt />} {t("collect")}{" "}
								{amountValue ? mad(amountValue) : ""}
							</Button>
						</>
					) : (
						<>
							{!inline && (
								<Button type="button" variant="outline" onClick={onDone}>
									{t("close")}
								</Button>
							)}
							{changed && (
								<Button type="button" disabled={saving} onClick={() => save(false)}>
									{saving && <LuLoader className="animate-spin" />} {t("saveActs")}
								</Button>
							)}
						</>
					)}
				</Footer>
			)}
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
	const t = useTranslations("payments.movements");
	const methods = useTranslations("payments.methods");
	const format = useFormat();
	const { mad, clock: time } = format;
	const owner = user.role === "owner";
	const canRefund = owner && !account.dayClosed && account.paid > 0 && account.chargeId;

	return (
		<section className="grid gap-2">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium">{t("payments")}</h3>
				{canRefund && !refunding && (
					<Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setRefunding(true)}>
						<LuUndo2 className="rtl:-scale-x-100" /> {t("refund")}
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
								{p.kind === "refund" ? t("refundLabel") : methods(p.method)}
								{p.kind === "refund" && ` (${methods(p.method).toLowerCase()})`}
								{p.reference && ` · ${p.reference}`} · {time(p.receivedAt)}
								{p.receivedBy && ` · ${p.receivedBy}`}
							</span>
							{p.cancelledAt && (
								<Badge variant="outline" className="font-normal">
									{t("cancelled")}
								</Badge>
							)}
							<span className="ms-auto flex items-center gap-1">
								{p.receiptNumber && !p.cancelledAt && (
									<Button asChild variant="ghost" size="sm" className="h-7 font-mono text-xs">
										<a href={`/receipts/${p.id}`} target="_blank" rel="noopener" title={t("print")}>
											<LuPrinter /> {p.receiptNumber}
										</a>
									</Button>
								)}
								{!p.cancelledAt && !p.locked && (owner || p.receivedById === user.id) && cancelling !== p.id && (
									<Button type="button" variant="ghost" size="sm" className="text-muted-foreground h-7" onClick={() => setCancelling(p.id)}>
										{t("cancel")}
									</Button>
								)}
							</span>
						</div>
						{(p.cancelReason || p.reason) && (
							<p className="text-muted-foreground text-xs">
								{p.cancelledAt
									? p.cancelledBy
										? t("cancelledByReason", { name: p.cancelledBy, reason: p.cancelReason ?? "" })
										: t("cancelledReason", { reason: p.cancelReason ?? "" })
									: t("reason", { reason: p.reason ?? "" })}
							</p>
						)}
						{cancelling === p.id && (
							<ReasonForm
								label={t("cancelLabel")}
								action={t("cancelAction")}
								onCancel={() => setCancelling(null)}
								onSubmit={async (reason) => {
									const next = await api<Account>(`/payments/${p.id}/cancel`, {
										method: "POST",
										body: JSON.stringify({ reason }),
									});
									setCancelling(null);
									toast.success(t("paymentCancelled"));
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
						toast.success(t("refunded"));
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
	const t = useTranslations("payments.movements");
	return (
		<form
			className="flex flex-wrap gap-2"
			onSubmit={async (e) => {
				e.preventDefault();
				if (reason.trim().length < 3) return toast.error(t("reasonRequired"));
				setPending(true);
				try {
					await onSubmit(reason.trim());
				} catch (err) {
					toast.error(err instanceof Error ? err.message : t("error"));
				} finally {
					setPending(false);
				}
			}}
		>
			<Input autoFocus value={reason} maxLength={300} placeholder={label} aria-label={label} onChange={(e) => setReason(e.target.value)} className="h-8 min-w-48 flex-1" />
			<Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel}>
				{t("back")}
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
	const t = useTranslations("payments.movements");
	const methods = useTranslations("payments.methods");
	const { mad } = useFormat();

	return (
		<form
			className="bg-muted/40 grid gap-2 rounded-lg border p-3"
			onSubmit={async (e) => {
				e.preventDefault();
				if (value === null || value <= 0 || value > max) return toast.error(t("amountRange", { max: mad(max) }));
				if (reason.trim().length < 3) return toast.error(t("reasonRequired"));
				setPending(true);
				try {
					await onDone(
						await api<Account>(`/charges/${chargeId}/refunds`, {
							method: "POST",
							body: JSON.stringify({ amount: value, method, reason: reason.trim() }),
						}),
					);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : t("refundError"));
				} finally {
					setPending(false);
				}
			}}
		>
			<p className="text-sm font-medium">{t("refundTitle")}</p>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="relative">
					<Input inputMode="decimal" value={amount} aria-label={t("refundAmount")} onChange={(e) => setAmount(e.target.value)} className="h-8 pe-12 text-end tabular-nums" />
					<span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs">MAD</span>
				</div>
				<Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
					<SelectTrigger size="sm" aria-label={t("refundMethod")} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{METHODS.map((m) => (
							<SelectItem key={m.value} value={m.value}>
								{methods(m.value)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<Input value={reason} maxLength={300} placeholder={t("refundReason")} aria-label={t("refundReason")} onChange={(e) => setReason(e.target.value)} className="h-8" />
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					{t("back")}
				</Button>
				<Button type="submit" size="sm" disabled={pending}>
					{pending && <LuLoader className="animate-spin" />} {t("refund")} {value ? mad(value) : ""}
				</Button>
			</div>
		</form>
	);
}

