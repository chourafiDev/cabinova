"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PAYMENT_KEYS } from "@/app/(clinic)/payments/_components/checkout-dialog";
import {
	IconCheckCircle,
	IconLock,
	IconPill,
	IconPrinter,
	IconReceipt,
	IconSignature,
	IconSpinner,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SHEET_AT_END, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { type Certificate, periodDays } from "@/lib/certificates";
import { initials } from "@/lib/format";
import { formatFileNumber } from "@/lib/patients";
import { type Account, METHODS, type PaymentMethod } from "@/lib/payments";
import type { Prescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * A finished visit, for the front desk: what to take from the patient (and
 * "Payé" once they paid), then the ordonnance and the certificates the
 * doctor wrote, to print and hand over. Read-only for everything medical.
 */
export function VisitSheet({
	appointmentId,
	onOpenChange,
}: {
	/** null: closed. */
	appointmentId: string | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet open={appointmentId !== null} onOpenChange={onOpenChange}>
			<SheetContent className={`w-full gap-0 data-[side=right]:sm:max-w-xl ${SHEET_AT_END}`}>
				{appointmentId && <Visit key={appointmentId} appointmentId={appointmentId} />}
			</SheetContent>
		</Sheet>
	);
}

type Tab = "payment" | "prescription" | "certificates";

function Visit({ appointmentId }: { appointmentId: string }) {
	const t = useTranslations("agenda.seen.detail");
	const [tab, setTab] = useState<Tab>("payment");
	const account = useQuery({
		queryKey: ["account", appointmentId],
		queryFn: () => api<Account>(`/appointments/${appointmentId}/account`),
	});
	const prescription = useQuery({
		queryKey: ["prescription-visit", appointmentId],
		queryFn: () =>
			api<{ prescription: Prescription | null }>(`/prescriptions/visit/${appointmentId}`).then((r) => r.prescription),
	});
	const certificates = useQuery({
		queryKey: ["certificates", "visit", appointmentId],
		queryFn: () => api<Certificate[]>(`/certificates/visit/${appointmentId}`),
	});

	const visit = account.data?.appointment;
	const name = visit ? `${visit.patient.firstName} ${visit.patient.lastName}` : null;
	const lines = prescription.data?.items.length ?? 0;
	const given = certificates.data?.filter((c) => !c.cancelledAt).length ?? 0;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SheetHeader className="border-b p-5">
				{visit && name ? (
					<div className="flex items-center gap-3">
						<span className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
							{initials(name)}
						</span>
						<div className="min-w-0">
							<SheetTitle className="truncate text-xl">{name}</SheetTitle>
							<SheetDescription>
								{visit.practitioner.name} · {formatFileNumber(visit.patient.fileNumber)}
							</SheetDescription>
						</div>
					</div>
				) : (
					<>
						<SheetTitle>{t("title")}</SheetTitle>
						<SheetDescription>{account.error ? account.error.message : t("loading")}</SheetDescription>
					</>
				)}
			</SheetHeader>

			<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col gap-0">
				<div className="border-b px-5 py-3">
					<TabsList className="w-full">
						<TabsTrigger value="payment">
							<IconReceipt /> {t("tabs.payment")}
						</TabsTrigger>
						<TabsTrigger value="prescription">
							<IconPill /> {t("tabs.prescription")}
							{lines > 0 && <Count>{lines}</Count>}
						</TabsTrigger>
						<TabsTrigger value="certificates">
							<IconSignature /> {t("tabs.certificates")}
							{given > 0 && <Count>{given}</Count>}
						</TabsTrigger>
					</TabsList>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-5">
					<TabsContent value="payment">
						{account.data ? <PaymentTab account={account.data} /> : <Skeleton className="h-60" />}
					</TabsContent>
					<TabsContent value="prescription">
						<PrescriptionTab appointmentId={appointmentId} prescription={prescription.data} loading={prescription.isPending} />
					</TabsContent>
					<TabsContent value="certificates">
						<CertificatesTab certificates={certificates.data} />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

function Count({ children }: { children: React.ReactNode }) {
	return <span className="bg-primary/12 text-primary rounded px-1.5 text-xs tabular-nums">{children}</span>;
}

/** What to take from the patient: the acts, the réduction, what was paid; "Payé" records the rest. */
function PaymentTab({ account }: { account: Account }) {
	const t = useTranslations("agenda.seen.detail");
	const payments = useTranslations("payments");
	const format = useFormat();
	const { mad } = format;
	const queryClient = useQueryClient();
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [paying, setPaying] = useState(false);

	const { appointment: visit } = account;
	const name = `${visit.patient.firstName} ${visit.patient.lastName}`;
	const received = account.payments.filter((p) => !p.cancelledAt);
	const charged = account.chargeId !== null;
	const due = Math.max(0, account.balance);
	const payable = charged && due > 0;

	// The rest, in full: the acts stay as the doctor saved them.
	const markPaid = async () => {
		setPaying(true);
		try {
			const res = await api<Account>(`/appointments/${visit.id}/checkout`, {
				method: "POST",
				body: JSON.stringify({
					items: account.items.map(({ actId, label, unitPrice, quantity }) => ({
						actId: actId ?? undefined,
						label,
						unitPrice,
						quantity,
					})),
					payment: { amount: due, method },
				}),
			});
			queryClient.setQueryData(["account", visit.id], res);
			await Promise.all(PAYMENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
			toast.success(t("paidToast", { amount: mad(due), name }));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("payError"));
		} finally {
			setPaying(false);
		}
	};

	return (
		<div className="grid gap-5">
			{/* The one number the desk needs, first. */}
			<div
				className={cn(
					"grid gap-0.5 rounded-xl border p-4 text-center",
					!charged || due > 0 ? "border-primary bg-primary/20 text-primary" : "border-emerald-200 bg-emerald-50 text-emerald-800",
				)}
			>
				<p className="text-xs font-medium">{!charged ? t("noActs") : due > 0 ? t("toCollect") : t("settled")}</p>
				{/* Settled: what was paid, rather than a "0 MAD". */}
				{charged && <p className="text-2xl font-semibold tabular-nums">{mad(due > 0 ? due : account.paid)}</p>}
				{!charged && <p className="text-xs">{t("noActsHint")}</p>}
				{account.balance < 0 && <p className="text-xs">{t("overpaid", { amount: mad(-account.balance) })}</p>}
			</div>

			{charged && (
				<section className="grid gap-2">
					<h3 className="text-sm font-medium">{t("acts")}</h3>
					<ul className="divide-y rounded-lg border text-sm">
						{account.items.map((item) => (
							<li key={item.id} className="flex items-center gap-3 px-3 py-2">
								<span className="min-w-0 flex-1 truncate">
									{item.label}
									{item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
								</span>
								<span className="tabular-nums">{mad(item.unitPrice * item.quantity)}</span>
							</li>
						))}
					</ul>
					<dl className="bg-muted/50 grid gap-1.5 rounded-lg p-3 text-sm">
						<Line label={t("actsTotal")} value={mad(account.subtotal)} />
						{account.discount > 0 && (
							<Line label={t("discount")} value={`− ${mad(account.discount)}`} className="text-emerald-700" />
						)}
						<Line label={t("patientPays")} value={mad(account.total)} strong={account.paid === 0} />
						{account.paid !== 0 && (
							<>
								<Line label={t("alreadyPaid")} value={mad(account.paid)} />
								<Line label={t("remaining")} value={mad(due)} strong />
							</>
						)}
					</dl>
				</section>
			)}

			{received.length > 0 && (
				<section className="grid gap-2">
					<h3 className="text-sm font-medium">{t("payments")}</h3>
					<ul className="divide-y rounded-lg border text-sm">
						{received.map((p) => (
							<li key={p.id} className="flex items-center gap-3 px-3 py-2">
								<div className="min-w-0 flex-1">
									<p className={cn("font-medium tabular-nums", p.kind === "refund" && "text-destructive")}>
										{p.kind === "refund" ? `− ${mad(p.amount)}` : mad(p.amount)}
										<span className="text-muted-foreground ms-1.5 font-normal">{payments(`methods.${p.method}`)}</span>
									</p>
									<p className="text-muted-foreground text-xs">
										{format.clock(p.receivedAt)}
										{p.receivedBy && ` · ${p.receivedBy}`}
										{p.receiptNumber && ` · ${p.receiptNumber}`}
									</p>
								</div>
								{p.kind === "payment" && (
									<Button asChild variant="ghost" size="icon-sm" aria-label={t("print")} title={t("print")}>
										<a href={`/receipts/${p.id}`} target="_blank" rel="noopener">
											<IconPrinter />
										</a>
									</Button>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{payable && account.dayClosed && (
				<p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
					<IconLock className="mt-0.5 size-4 shrink-0" />
					{t("locked")}
				</p>
			)}

			{payable && !account.dayClosed && (
				<section className="grid gap-3">
					<div className="grid gap-2">
						<h3 className="text-sm font-medium">{t("method")}</h3>
						<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("method")}>
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
					</div>
					<Button onClick={markPaid} disabled={paying}>
						{paying ? <IconSpinner className="animate-spin" /> : <IconCheckCircle />} {t("markPaid", { amount: mad(due) })}
					</Button>
				</section>
			)}
		</div>
	);
}

function Line({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
	return (
		<div className={cn("flex justify-between", strong && "border-t pt-1.5")}>
			<dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
			<dd className={cn("tabular-nums", strong && "font-semibold", className)}>{value}</dd>
		</div>
	);
}

/** The ordonnance written at this visit, to print. */
function PrescriptionTab({
	appointmentId,
	prescription,
	loading,
}: {
	appointmentId: string;
	prescription: Prescription | null | undefined;
	loading: boolean;
}) {
	const t = useTranslations("agenda.seen.detail");
	if (loading) return <Skeleton className="h-40" />;
	if (!prescription || prescription.items.length === 0) return <Empty icon={IconPill} text={t("noPrescription")} />;
	return (
		<section className="grid gap-3">
			<ol className="divide-y rounded-lg border text-sm">
				{prescription.items.map((item, i) => (
					<li key={i} className="flex gap-3 px-3 py-2.5">
						<span className="text-muted-foreground w-4 shrink-0 text-end tabular-nums">{i + 1}.</span>
						<span className="min-w-0">
							<span className="block font-medium">{item.medication}</span>
							{(item.posology || item.duration) && (
								<span className="text-muted-foreground block">{[item.posology, item.duration].filter(Boolean).join(" · ")}</span>
							)}
						</span>
					</li>
				))}
			</ol>
			{prescription.notes && (
				<p className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-sm whitespace-pre-line">{prescription.notes}</p>
			)}
			<Button asChild>
				<a href={`/ordonnances/${appointmentId}`} target="_blank" rel="noopener">
					<IconPrinter /> {t("printPrescription")}
				</a>
			</Button>
		</section>
	);
}

/** The certificates given at this visit, each to print (a cancelled one stays listed, struck). */
function CertificatesTab({ certificates }: { certificates: Certificate[] | undefined }) {
	const t = useTranslations("agenda.seen.detail");
	const cert = useTranslations("dossier.certificate");
	const format = useFormat();
	if (!certificates) return <Skeleton className="h-40" />;
	if (certificates.length === 0) return <Empty icon={IconSignature} text={t("noCertificate")} />;
	return (
		<ul className="grid gap-3">
			{certificates.map((c) => (
				<li key={c.id} className="rounded-lg border">
					<div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
						<p className={cn("min-w-0 flex-1 text-sm font-medium", c.cancelledAt && "text-muted-foreground line-through")}>
							{c.kind === "period"
								? cert("periodSummary", {
										days: periodDays(c.startsOn, c.endsOn ?? c.startsOn) ?? 1,
										from: format.date(c.startsOn),
										to: format.date(c.endsOn ?? c.startsOn),
									})
								: cert("daySummary", { date: format.date(c.startsOn) })}
						</p>
						{c.cancelledAt ? (
							<Badge variant="destructive">{cert("cancelled")}</Badge>
						) : (
							<Button asChild size="sm" className="h-8">
								<a href={`/certificats/${c.id}`} target="_blank" rel="noopener">
									<IconPrinter /> {cert("print")}
								</a>
							</Button>
						)}
					</div>
					{/* Sanitized by the API when it was given: the editor's formatting only. */}
					<div
						className={cn(
							"p-3 text-sm leading-relaxed [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ps-6",
							c.cancelledAt && "text-muted-foreground",
						)}
						dangerouslySetInnerHTML={{ __html: c.body }}
					/>
				</li>
			))}
		</ul>
	);
}

function Empty({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
	return (
		<div className="flex flex-col items-center gap-2 py-12 text-center">
			<Icon className="text-muted-foreground size-6" />
			<p className="text-muted-foreground max-w-xs text-sm">{text}</p>
		</div>
	);
}
