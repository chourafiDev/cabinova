"use client";

import { differenceInMinutes } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Abbreviation } from "@/components/act-picker";
import { useCurrentUser } from "@/components/current-user";
import { IconFolderOpen, IconReceiptText, IconUserCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Appointment } from "@/lib/appointments";
import { dossierHref, formatFileNumber, fullName, isMedicalRole, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PaymentDetailDialog } from "./payment-detail-dialog";
import { useWaiting } from "./use-today";

/** What is left to pay on a visit: null when settled. */
const dueOf = (a: Appointment) => (a.charge ? Math.max(0, a.charge.total - a.charge.paid) : null);
const settled = (a: Appointment) => a.charge !== null && dueOf(a) === 0;

/** Longer than this is a visit left open by mistake, not a duration worth showing. */
const MAX_VISIT_MINUTES = 8 * 60;

/**
 * Patients vus: today's visits the doctor finished ("Terminer"), the latest
 * first. The front desk sees what each one owes (acts, remboursement, paid)
 * before taking the money; the doctor gets back to a file in one click.
 */
export function SeenToday() {
	const t = useTranslations("agenda.seen");
	const waitingText = useTranslations("agenda.waiting");
	const { seen, isPending, isError } = useWaiting();
	const doctor = isMedicalRole(useCurrentUser().role);
	const [detail, setDetail] = useState<string | null>(null);
	const toCheckOut = seen.filter((a) => !settled(a)).length;

	return (
		<div className="grid gap-4">
			<p className="text-muted-foreground text-sm">
				{!isPending && t("count", { count: seen.length })}
				{toCheckOut > 0 && (
					<span className="ms-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
						{t("toCheckOut", { count: toCheckOut })}
					</span>
				)}
			</p>

			{isPending ? (
				<div className="bg-card grid gap-2 rounded-xl border p-4">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</div>
			) : isError ? (
				<p className="text-destructive text-sm">{waitingText("loadError")}</p>
			) : seen.length === 0 ? (
				<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center">
					<IconUserCheck className="text-muted-foreground size-6" />
					<p className="font-medium">{t("empty")}</p>
					<p className="text-muted-foreground max-w-sm text-sm">{t("emptyHint")}</p>
				</div>
			) : (
				<SeenTable seen={seen} doctor={doctor} onDetail={setDetail} />
			)}

			<PaymentDetailDialog appointmentId={detail} onOpenChange={(open) => !open && setDetail(null)} />
		</div>
	);
}

function SeenTable({
	seen,
	doctor,
	onDetail,
}: {
	seen: Appointment[];
	doctor: boolean;
	onDetail: (id: string) => void;
}) {
	const t = useTranslations("agenda.seen");
	const fmt = useFormat();

	return (
		<div className="bg-card overflow-hidden rounded-xl border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-16">{t("finishedAt")}</TableHead>
						<TableHead>{t("patient")}</TableHead>
						<TableHead className="hidden lg:table-cell">{t("practitioner")}</TableHead>
						<TableHead className="hidden xl:table-cell">{t("reason")}</TableHead>
						<TableHead className="hidden md:table-cell">{t("duration")}</TableHead>
						<TableHead>{t("payment")}</TableHead>
						<TableHead className="w-0">
							<span className="sr-only">{t("actions")}</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{seen.map((a) => {
						const due = dueOf(a);
						const paid = settled(a);
						const length =
							a.consultationStartedAt && a.completedAt
								? Math.max(1, differenceInMinutes(new Date(a.completedAt), new Date(a.consultationStartedAt)))
								: null;
						const minutes = length !== null && length <= MAX_VISIT_MINUTES ? length : null;
						return (
							<TableRow key={a.id}>
								<TableCell className="font-medium tabular-nums">{a.completedAt ? fmt.clock(a.completedAt) : "—"}</TableCell>
								<TableCell>
									<Link href={patientHref(a.patient.id)} className="font-medium hover:underline">
										{fullName(a.patient)}
									</Link>
									<p className="text-muted-foreground font-mono text-xs">{formatFileNumber(a.patient.fileNumber)}</p>
								</TableCell>
								<TableCell className="hidden lg:table-cell">{a.practitioner.name}</TableCell>
								<TableCell className="text-muted-foreground hidden max-w-48 xl:table-cell">
									<span className="flex items-center gap-1.5 truncate">
										{a.reasonShort && <Abbreviation>{a.reasonShort}</Abbreviation>}
										<span className="truncate">{a.reason ?? "—"}</span>
									</span>
								</TableCell>
								<TableCell className="text-muted-foreground hidden tabular-nums md:table-cell">
									{minutes === null ? "—" : fmt.duration(minutes)}
								</TableCell>
								<TableCell>
									<span
										className={cn(
											"rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
											paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
										)}
									>
										{paid ? t("paid") : due === null ? t("notCharged") : t("due", { amount: fmt.mad(due) })}
									</span>
								</TableCell>
								<TableCell>
									<div className="flex items-center justify-end gap-1.5">
										{doctor && (
											<Button asChild size="icon-sm" variant="ghost" aria-label={t("openFile")} title={t("openFile")}>
												<Link href={dossierHref(a.patient.id, a.id)}>
													<IconFolderOpen />
												</Link>
											</Button>
										)}
										<Button size="sm" variant={paid ? "outline" : "default"} onClick={() => onDetail(a.id)}>
											<IconReceiptText /> {t("account")}
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
