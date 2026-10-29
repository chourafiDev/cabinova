"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuCalendarCheck, LuCircleCheck, LuLoader, LuLock, LuReceipt, LuTriangleAlert } from "react-icons/lu";
import { toast } from "sonner";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { AppointmentStatus } from "@/lib/appointments";
import { formatDate } from "@/lib/format";
import { formatFileNumber } from "@/lib/patients";
import { type Desk, mad, METHOD_LABELS, type PaymentMethod, parseMad } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { CheckoutDialog } from "./checkout-dialog";

const time = (iso: string) => formatDate(iso, { day: undefined, month: undefined, year: undefined, hour: "2-digit", minute: "2-digit" });

/** How a visit stands: nothing billed yet, settled, partly paid, owed. */
function Settlement({ total, paid, balance }: { total: number | null; paid: number; balance: number | null }) {
	const tone = (className: string, label: string) => (
		<Badge variant="outline" className={cn("border-transparent font-normal", className)}>
			{label}
		</Badge>
	);
	if (total === null || balance === null) return tone("bg-muted text-muted-foreground", "À facturer");
	if (total === 0) return tone("bg-muted text-muted-foreground", "Gratuit");
	if (balance === 0) return tone("bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", "Réglé");
	if (balance < 0) return tone("bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", `Trop-perçu ${mad(-balance)}`);
	return tone(
		"bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
		paid > 0 ? `Reste ${mad(balance)}` : `À encaisser ${mad(balance)}`,
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
					<p className="font-medium first-letter:uppercase">{formatDate(`${day}T12:00:00`, { weekday: "long", year: undefined })}</p>
					<p className="text-muted-foreground text-sm">
						{closed
							? `Caisse clôturée à ${time(closed.closedAt)}${closed.closedBy ? ` par ${closed.closedBy}` : ""}`
							: `Caisse ouverte${spaceName ? ` · ${spaceName}` : ""}`}
					</p>
				</div>
				{closed ? (
					<Badge variant="outline" className="gap-1.5 font-normal">
						<LuLock className="size-3" /> Clôturée
					</Badge>
				) : (
					<Button variant="outline" onClick={() => setClosing(true)}>
						<LuLock /> Clôturer la caisse
					</Button>
				)}
			</div>

			<section className="bg-card overflow-hidden rounded-xl border">
				<h2 className="border-b px-4 py-3 text-sm font-semibold">Visites du jour</h2>
				{visits.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
						<LuCalendarCheck className="text-muted-foreground size-6" />
						<p className="font-medium">Aucun rendez-vous aujourd’hui</p>
						<p className="text-muted-foreground text-sm">Les visites de l’agenda apparaissent ici pour être encaissées.</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">Heure</TableHead>
								<TableHead>Patient</TableHead>
								<TableHead className="hidden md:table-cell">Médecin</TableHead>
								<TableHead className="hidden lg:table-cell">Rendez-vous</TableHead>
								<TableHead className="text-end">Montant</TableHead>
								<TableHead>Règlement</TableHead>
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
														<LuReceipt /> Encaisser
													</>
												) : (
													"Voir"
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
						<h2 className="text-sm font-semibold">Impayés</h2>
						<p className="text-muted-foreground text-xs">Visites passées qui n’ont pas été entièrement réglées.</p>
					</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Visite</TableHead>
								<TableHead>Patient</TableHead>
								<TableHead className="hidden md:table-cell">Médecin</TableHead>
								<TableHead className="text-end">Reste à payer</TableHead>
								<TableHead className="w-28" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{unpaid.map((v) => (
								<TableRow key={v.id}>
									<TableCell className="tabular-nums">{formatDate(v.startsAt, { month: "short" })}</TableCell>
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
											{closed ? "Voir" : (
												<>
													<LuReceipt /> Encaisser
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

	const close = async (e: React.FormEvent) => {
		e.preventDefault();
		const value = parseMad(counted || "");
		if (value === null) return setError("Saisissez le montant compté (0 s’il n’y a pas d’espèces).");
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
				toast.success("Caisse clôturée");
				onOpenChange(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Clôture impossible");
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
							<DialogTitle>Caisse clôturée</DialogTitle>
							<DialogDescription>Plus aucun paiement ne peut être saisi aujourd’hui dans cet espace.</DialogDescription>
						</DialogHeader>
						<dl className="grid gap-1.5 text-sm">
							{(Object.keys(result.expected) as PaymentMethod[]).map((m) => (
								<div key={m} className="flex justify-between">
									<dt className="text-muted-foreground">{METHOD_LABELS[m]} attendu</dt>
									<dd className="tabular-nums">{mad(result.expected![m])}</dd>
								</div>
							))}
							<div className="flex justify-between border-t pt-1.5">
								<dt className="text-muted-foreground">Espèces comptées</dt>
								<dd className="tabular-nums">{mad(result.countedCash!)}</dd>
							</div>
							<div className="flex items-center justify-between font-medium">
								<dt>Écart</dt>
								<dd className="flex items-center gap-1.5 tabular-nums">
									{result.difference === 0 ? (
										<LuCircleCheck className="size-4 text-emerald-600" />
									) : (
										<LuTriangleAlert className="size-4 text-amber-600" />
									)}
									{result.difference! > 0 ? "+" : ""}
									{mad(result.difference!)}
								</dd>
							</div>
						</dl>
						<DialogFooter>
							<Button onClick={() => onOpenChange(false)}>Terminé</Button>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={close} noValidate className="grid gap-4">
						<DialogHeader>
							<DialogTitle>Clôturer la caisse du jour</DialogTitle>
							<DialogDescription>
								Comptez les espèces encaissées aujourd’hui (sans le fond de caisse) et saisissez le total. Une fois la
								caisse clôturée, plus aucun paiement ni annulation n’est possible pour aujourd’hui.
							</DialogDescription>
						</DialogHeader>
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="counted-cash">Espèces comptées</FieldLabel>
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
								<FieldDescription>Le médecin responsable verra l’écart éventuel avec les paiements enregistrés.</FieldDescription>
							)}
							{error && <p className="text-destructive text-sm">{error}</p>}
						</Field>
						<Field>
							<FieldLabel htmlFor="close-note">Note (facultatif)</FieldLabel>
							<Textarea id="close-note" value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />
						</Field>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Annuler
							</Button>
							<Button type="submit" disabled={pending}>
								{pending ? <LuLoader className="animate-spin" /> : <LuLock />} Clôturer
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
