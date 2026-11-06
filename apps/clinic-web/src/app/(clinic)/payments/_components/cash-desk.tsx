"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { useCurrentUser } from "@/components/current-user";
import {
	IconCalendarCheck,
	IconCheckCircle,
	IconLock,
	IconReceipt,
	IconSpinner,
	IconWarning,
} from "@/components/icons";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { AppointmentStatus } from "@/lib/appointments";
import { formatFileNumber } from "@/lib/patients";
import { type Desk, type PaymentMethod, parseMad } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { CheckoutDialog } from "./checkout-dialog";

/** How a visit stands: nothing billed yet, settled, partly paid, owed. */
function Settlement({ total, paid, balance }: { total: number | null; paid: number; balance: number | null }) {
	const t = useTranslations("payments.settlement");
	const { mad } = useFormat();
	const tone = (className: string, label: string) => (
		<Badge variant="outline" className={cn("border-transparent font-normal", className)}>
			{label}
		</Badge>
	);
	if (total === null || balance === null) return tone("bg-muted text-muted-foreground", t("toBill"));
	if (total === 0) return tone("bg-muted text-muted-foreground", t("free"));
	if (balance === 0) return tone("bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", t("settled"));
	if (balance < 0) return tone("bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", t("overpaid", { amount: mad(-balance) }));
	return tone(
		"bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
		paid > 0 ? t("remaining", { amount: mad(balance) }) : t("toCollect", { amount: mad(balance) }),
	);
}

/**
 * Caisse du jour, for the whole staff: today's visits in the space and
 * what each still owes, older unpaid visits, and the day's close.
 */
export function CashDesk({ spaceName }: { spaceName: string | null }) {
	const user = useCurrentUser();
	const desk = useQuery({ queryKey: ["desk"], queryFn: () => api<Desk>("/cashier/today") });
	const [checkout, setCheckout] = useState<string | null>(null);
	const [closing, setClosing] = useState(false);
	const t = useTranslations("payments.desk");
	const format = useFormat();
	const { mad, clock: time } = format;

	if (!desk.data) {
		return (
			<div className="grid gap-4">
				<Skeleton className="h-12" />
				<Skeleton className="h-64" />
				{desk.error && <p className="text-destructive text-sm">{desk.error.message}</p>}
			</div>
		);
	}
	const { visits, unpaid, closed, day } = desk.data;

	return (
		<div className="grid gap-4">
			<div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
				<div>
					<p className="font-medium first-letter:uppercase">{format.date(`${day}T12:00:00`, { weekday: "long", year: undefined })}</p>
					<p className="text-muted-foreground text-sm">
						{closed
							? closed.closedBy
								? t("closedAtBy", { time: time(closed.closedAt), name: closed.closedBy })
								: t("closedAt", { time: time(closed.closedAt) })
							: `${t("open")}${spaceName ? ` · ${spaceName}` : ""}`}
					</p>
				</div>
				{closed ? (
					<Badge variant="outline" className="gap-1.5 font-normal">
						<IconLock className="size-3" /> {t("closed")}
					</Badge>
				) : (
					<Button variant="outline" onClick={() => setClosing(true)}>
						<IconLock /> {t("close")}
					</Button>
				)}
			</div>

			<section className="bg-card overflow-hidden rounded-xl border">
				<h2 className="border-b px-4 py-3 text-sm font-semibold">{t("visits")}</h2>
				{visits.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
						<IconCalendarCheck className="text-muted-foreground size-6" />
						<p className="font-medium">{t("noVisits")}</p>
						<p className="text-muted-foreground text-sm">{t("noVisitsHint")}</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">{t("time")}</TableHead>
								<TableHead>{t("patient")}</TableHead>
								<TableHead className="hidden md:table-cell">{t("doctor")}</TableHead>
								<TableHead className="hidden lg:table-cell">{t("appointment")}</TableHead>
								<TableHead className="text-end">{t("amount")}</TableHead>
								<TableHead>{t("settlement")}</TableHead>
								<TableHead className="w-28" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{visits.map((v) => {
								const owed = v.balance === null || v.balance > 0;
								return (
									<TableRow key={v.id}>
										<TableCell className="tabular-nums">{time(v.startsAt)}</TableCell>
										<TableCell>
											<div className="font-medium">
												{v.patient.firstName} {v.patient.lastName}
											</div>
											<div className="text-muted-foreground text-xs tabular-nums">{formatFileNumber(v.patient.fileNumber)}</div>
										</TableCell>
										<TableCell className="text-muted-foreground hidden md:table-cell">{v.practitioner}</TableCell>
										<TableCell className="hidden lg:table-cell">
											<AppointmentStatusBadge status={v.status as AppointmentStatus} />
										</TableCell>
										<TableCell className="text-end tabular-nums">{v.total === null ? "—" : mad(v.total)}</TableCell>
										<TableCell>
											<Settlement total={v.total} paid={v.paid} balance={v.balance} />
										</TableCell>
										<TableCell className="text-end">
											<Button size="sm" variant={owed && !closed ? "default" : "outline"} onClick={() => setCheckout(v.id)}>
												{owed && !closed ? (
													<>
														<IconReceipt /> {t("collect")}
													</>
												) : (
													t("view")
												)}
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</section>

			{unpaid.length > 0 && (
				<section className="bg-card overflow-hidden rounded-xl border">
					<div className="border-b px-4 py-3">
						<h2 className="text-sm font-semibold">{t("unpaid")}</h2>
						<p className="text-muted-foreground text-xs">{t("unpaidHint")}</p>
					</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("visit")}</TableHead>
								<TableHead>{t("patient")}</TableHead>
								<TableHead className="hidden md:table-cell">{t("doctor")}</TableHead>
								<TableHead className="text-end">{t("due")}</TableHead>
								<TableHead className="w-28" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{unpaid.map((v) => (
								<TableRow key={v.id}>
									<TableCell className="tabular-nums">{format.date(v.startsAt, { month: "short" })}</TableCell>
									<TableCell>
										<div className="font-medium">
											{v.patient.firstName} {v.patient.lastName}
										</div>
										<div className="text-muted-foreground text-xs tabular-nums">{formatFileNumber(v.patient.fileNumber)}</div>
									</TableCell>
									<TableCell className="text-muted-foreground hidden md:table-cell">{v.practitioner}</TableCell>
									<TableCell className="text-end font-medium tabular-nums">{mad(v.balance)}</TableCell>
									<TableCell className="text-end">
										<Button size="sm" variant={closed ? "outline" : "default"} onClick={() => setCheckout(v.id)}>
											{closed ? t("view") : (
												<>
													<IconReceipt /> {t("collect")}
												</>
											)}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</section>
			)}

			<CheckoutDialog appointmentId={checkout} onOpenChange={(o) => !o && setCheckout(null)} />
			<CloseDialog open={closing} onOpenChange={setClosing} owner={user.role === "owner"} />
		</div>
	);
}

type CloseResult = {
	closedAt: string;
	expected?: Record<PaymentMethod, number>;
	countedCash?: number;
	difference?: number;
};

/**
 * Clôture: the cash is counted blind; once closed, nothing moves that day.
 * The owner gets the expected amounts and the difference right away.
 */
function CloseDialog({ open, onOpenChange, owner }: { open: boolean; onOpenChange: (open: boolean) => void; owner: boolean }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [counted, setCounted] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [result, setResult] = useState<CloseResult | null>(null);
	const t = useTranslations("payments.closing");
	const methods = useTranslations("payments.methods");
	const { mad } = useFormat();

	const close = async (e: React.FormEvent) => {
		e.preventDefault();
		const value = parseMad(counted || "");
		if (value === null) return setError(t("countError"));
		setPending(true);
		setError(null);
		try {
			const res = await api<CloseResult>("/cashier/close", {
				method: "POST",
				body: JSON.stringify({ countedCash: value, note: note.trim() || undefined }),
			});
			await queryClient.invalidateQueries({ queryKey: ["desk"] });
			router.refresh();
			if (owner) setResult(res);
			else {
				toast.success(t("done"));
				onOpenChange(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t("error"));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					setResult(null);
					setCounted("");
					setNote("");
				}
			}}
		>
			<DialogContent className="sm:max-w-md">
				{result?.expected ? (
					<div className="grid gap-4">
						<DialogHeader>
							<DialogTitle>{t("done")}</DialogTitle>
							<DialogDescription>{t("doneHint")}</DialogDescription>
						</DialogHeader>
						<dl className="grid gap-1.5 text-sm">
							{(Object.keys(result.expected) as PaymentMethod[]).map((m) => (
								<div key={m} className="flex justify-between">
									<dt className="text-muted-foreground">{t("expected", { method: methods(m) })}</dt>
									<dd className="tabular-nums">{mad(result.expected![m])}</dd>
								</div>
							))}
							<div className="flex justify-between border-t pt-1.5">
								<dt className="text-muted-foreground">{t("countedCash")}</dt>
								<dd className="tabular-nums">{mad(result.countedCash!)}</dd>
							</div>
							<div className="flex items-center justify-between font-medium">
								<dt>{t("difference")}</dt>
								<dd className="flex items-center gap-1.5 tabular-nums">
									{result.difference === 0 ? (
										<IconCheckCircle className="size-4 text-emerald-600" />
									) : (
										<IconWarning className="size-4 text-amber-600" />
									)}
									{result.difference! > 0 ? "+" : ""}
									{mad(result.difference!)}
								</dd>
							</div>
						</dl>
						<DialogFooter>
							<Button onClick={() => onOpenChange(false)}>{t("finish")}</Button>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={close} noValidate className="grid gap-4">
						<DialogHeader>
							<DialogTitle>{t("title")}</DialogTitle>
							<DialogDescription>
								{t("description")}
							</DialogDescription>
						</DialogHeader>
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="counted-cash">{t("countedCash")}</FieldLabel>
							<div className="relative">
								<Input
									id="counted-cash"
									autoFocus
									inputMode="decimal"
									value={counted}
									placeholder="0"
									aria-invalid={!!error}
									onChange={(e) => setCounted(e.target.value)}
									className="pe-12 text-end text-base font-medium tabular-nums"
								/>
								<span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm">
									MAD
								</span>
							</div>
							{!owner && (
								<FieldDescription>{t("ownerSees")}</FieldDescription>
							)}
							{error && <p className="text-destructive text-sm">{error}</p>}
						</Field>
						<Field>
							<FieldLabel htmlFor="close-note">{t("note")}</FieldLabel>
							<Textarea id="close-note" value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />
						</Field>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								{t("cancel")}
							</Button>
							<Button type="submit" disabled={pending}>
								{pending ? <IconSpinner className="animate-spin" /> : <IconLock />} {t("submit")}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
