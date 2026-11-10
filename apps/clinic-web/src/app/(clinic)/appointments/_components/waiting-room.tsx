"use client";

import { differenceInMinutes } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconClock, IconFolderOpen, IconLogout, IconStethoscope, IconUndo, IconUserAdd } from "@/components/icons";
import { NoShowBadge } from "@/components/no-show-badge";
import { useCurrentUser } from "@/components/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Appointment, Practitioner } from "@/lib/appointments";
import { dossierHref, formatFileNumber, fullName, isMedicalRole, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { useWaitingActions } from "@/lib/use-waiting-actions";
import { cn } from "@/lib/utils";
import { useWaiting } from "./use-today";
import { WalkInSheet } from "./walk-in-sheet";

/** Waiting this long is shown in amber, then red. */
const LONG_WAIT = 20;
const VERY_LONG_WAIT = 45;

/**
 * Today's waiting room. Patients with an appointment arrive from the agenda;
 * one without is added here ("Patient sans RDV"). The doctor takes them by
 * opening their file;
 * the front desk only notes who left unseen, and who came back.
 */
export function WaitingRoom({ practitioners }: { practitioners: Practitioner[] }) {
	const [adding, setAdding] = useState(false);
	const t = useTranslations("agenda.waiting");
	const { waiting, inConsultation, left, isPending, isError } = useWaiting();
	const actions = useWaitingActions();
	const doctor = isMedicalRole(useCurrentUser().role);

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">{!isPending && t("count", { count: waiting.length })}</p>
				<Button size="sm" onClick={() => setAdding(true)}>
					<IconUserAdd /> {t("walkIn")}
				</Button>
			</div>

			{inConsultation.length > 0 && <InConsultation visits={inConsultation} doctor={doctor} />}

			{isPending ? (
				<div className="bg-card grid gap-2 rounded-xl border p-4">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</div>
			) : isError ? (
				<p className="text-destructive text-sm">{t("loadError")}</p>
			) : waiting.length === 0 ? (
				<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center">
					<IconClock className="text-muted-foreground size-6" />
					<p className="font-medium">{t("empty")}</p>
					<p className="text-muted-foreground max-w-sm text-sm">{t("emptyHint")}</p>
				</div>
			) : (
				<WaitingTable waiting={waiting} doctor={doctor} actions={actions} />
			)}

			{left.length > 0 && <LeftToday visits={left} actions={actions} />}

			<WalkInSheet practitioners={practitioners} open={adding} onOpenChange={setAdding} />
		</div>
	);
}

type Actions = ReturnType<typeof useWaitingActions>;

/**
 * Who is with a doctor now: the room is taken. A doctor gets back into the
 * dossier from here (after closing its tab, say); only the doctor ends the
 * visit, from the dossier ("Terminer la consultation").
 */
function InConsultation({ visits, doctor }: { visits: Appointment[]; doctor: boolean }) {
	const t = useTranslations("agenda.waiting");
	const now = useNow();
	const fmt = useFormat();
	return (
		<div className="grid gap-2">
			{visits.map((a) => {
				const since = a.consultationStartedAt ? Math.max(0, differenceInMinutes(now, new Date(a.consultationStartedAt))) : null;
				return (
					<div key={a.id} className="bg-primary flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
							<IconStethoscope className="size-4" />
						</span>
						<div className="min-w-0 flex-1 space-y-1">
							<p className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/80">
								{t("inConsultation")}
								{since !== null && (
									<span className="ms-1 tabular-nums">
										· {since < 1 ? t("justNow") : t("since", { duration: fmt.duration(since) })}
									</span>
								)}
							</p>
							<p className="truncate text-sm font-semibold text-white">
								{fullName(a.patient)} <span className="font-normal text-white/50">· {a.practitioner.name}</span>
							</p>
						</div>
						{doctor && (
							<Button asChild size="sm" variant="secondary" className="bg-background text-foreground hover:bg-background/90">
								<Link href={dossierHref(a.patient.id, a.id)}>
									<IconFolderOpen /> {t("resume")}
								</Link>
							</Button>
						)}
					</div>
				);
			})}
		</div>
	);
}

function WaitingTable({ waiting, doctor, actions }: { waiting: Appointment[]; doctor: boolean; actions: Actions }) {
	const now = useNow();
	const t = useTranslations("agenda.waiting");
	const panel = useTranslations("agenda.panel");
	const fmt = useFormat();

	return (
		<div className="bg-card overflow-hidden rounded-xl border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">{t("order")}</TableHead>
						<TableHead>{t("patient")}</TableHead>
						<TableHead>{t("appointment")}</TableHead>
						<TableHead className="hidden md:table-cell">{t("arrived")}</TableHead>
						<TableHead>{t("wait")}</TableHead>
						<TableHead className="hidden lg:table-cell">{t("practitioner")}</TableHead>
						<TableHead className="hidden xl:table-cell">{t("reason")}</TableHead>
						<TableHead className="w-0">
							<span className="sr-only">{t("actions")}</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{waiting.map((a, i) => {
						const minutes = a.arrivedAt ? Math.max(0, differenceInMinutes(now, new Date(a.arrivedAt))) : null;
						const busy = actions.busy === a.id;
						return (
							<TableRow key={a.id}>
								<TableCell>
									<span className="bg-muted flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
										{i + 1}
									</span>
								</TableCell>
								<TableCell>
									<Link href={patientHref(a.patient.id)} className="font-medium hover:underline">
										{fullName(a.patient)}
									</Link>
									<NoShowBadge count={a.patient.noShows} className="ms-2" />
									<p className="text-muted-foreground font-mono text-xs">{formatFileNumber(a.patient.fileNumber)}</p>
								</TableCell>
								<TableCell className="tabular-nums">
									{a.walkIn ? (
										<span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-sky-700">
											{t("noAppointment")}
										</span>
									) : (
										fmt.clock(a.startsAt)
									)}
								</TableCell>
								<TableCell className="hidden tabular-nums md:table-cell">
									{a.arrivedAt ? fmt.clock(a.arrivedAt) : "—"}
								</TableCell>
								<TableCell>
									{minutes === null ? (
										"—"
									) : (
										<span
											className={cn(
												"rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
												minutes >= VERY_LONG_WAIT
													? "bg-red-50 text-red-700"
													: minutes >= LONG_WAIT
														? "bg-amber-50 text-amber-800"
														: "bg-muted text-muted-foreground",
											)}
										>
											{minutes < 1 ? t("justNow") : fmt.duration(minutes)}
										</span>
									)}
								</TableCell>
								<TableCell className="hidden lg:table-cell">{a.practitioner.name}</TableCell>
								<TableCell className="text-muted-foreground hidden max-w-48 truncate xl:table-cell">
									{a.reason ?? "—"}
								</TableCell>
								<TableCell>
									<div className="flex items-center justify-end gap-1.5">
										{doctor ? (
											<>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="icon-sm"
															variant="ghost"
															aria-label={t("left")}
															disabled={busy}
															onClick={() => actions.left(a)}
														>
															<IconLogout className="rtl:-scale-x-100" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>{t("left")}</TooltipContent>
												</Tooltip>
												<Button size="sm" disabled={busy} onClick={() => actions.openFile(a)}>
													<IconFolderOpen /> {panel("openFile")}
												</Button>
											</>
										) : (
											<Button size="sm" variant="outline" disabled={busy} onClick={() => actions.left(a)}>
												<IconLogout className="rtl:-scale-x-100" /> {t("left")}
											</Button>
										)}
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

/** Left unseen today: their visit is cancelled, one click puts them back if they return. */
function LeftToday({ visits, actions }: { visits: Appointment[]; actions: Actions }) {
	const t = useTranslations("agenda.waiting");
	const fmt = useFormat();
	return (
		<section className="grid gap-2" aria-label={t("leftTitle")}>
			<h2 className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
				<IconLogout className="size-3.5 rtl:-scale-x-100" /> {t("leftTitle")}
			</h2>
			<ul className="bg-card divide-y rounded-xl border">
				{visits.map((a) => (
					<li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
						<div className="min-w-0 flex-1">
							<p className="text-muted-foreground truncate text-sm font-medium">
								{fullName(a.patient)}
							</p>
							<p className="text-muted-foreground text-xs">
								{t("leftAt", { time: a.leftAt ? fmt.clock(a.leftAt) : "—" })} ·{" "}
								{a.walkIn ? t("noAppointment") : t("appointmentAt", { time: fmt.clock(a.startsAt) })}
							</p>
						</div>
						<Button size="sm" variant="outline" disabled={actions.busy === a.id} onClick={() => actions.back(a)}>
							<IconUndo className="rtl:-scale-x-100" /> {t("back")}
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}
