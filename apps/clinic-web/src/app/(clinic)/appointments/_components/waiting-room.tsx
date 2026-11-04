"use client";

import { useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuArmchair, LuDoorOpen, LuUserPlus } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY, type Practitioner, patchAppointment } from "@/lib/appointments";
import { formatFileNumber, fullName, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { useWaiting } from "./use-today";
import { WalkInSheet } from "./walk-in-sheet";

/** Waiting this long is shown in amber, then red. */
const LONG_WAIT = 20;
const VERY_LONG_WAIT = 45;

/**
 * The waiting room as a table: who came first, how long they've waited, and
 * "Faire entrer". Patients with an appointment arrive from the agenda; one
 * without is added here ("Patient sans RDV").
 */
export function WaitingRoom({ practitioners }: { practitioners: Practitioner[] }) {
	const [adding, setAdding] = useState(false);
	const t = useTranslations("agenda.waiting");
	const { waiting } = useWaiting();

	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">{t("count", { count: waiting.length })}</p>
				<Button size="sm" onClick={() => setAdding(true)}>
					<LuUserPlus /> {t("walkIn")}
				</Button>
			</div>
			<WaitingTable />
			<WalkInSheet practitioners={practitioners} open={adding} onOpenChange={setAdding} />
		</div>
	);
}

function WaitingTable() {
	const { waiting, isPending, isError } = useWaiting();
	const queryClient = useQueryClient();
	const [calling, setCalling] = useState<string | null>(null);
	const now = useNow();
	const t = useTranslations("agenda.waiting");
	const panel = useTranslations("agenda.panel");
	const statusLabel = useTranslations("common.appointmentStatus");
	const fmt = useFormat();

	async function call(a: Appointment) {
		setCalling(a.id);
		// Leaves the table at once; comes back if the server refuses.
		const undo = patchAppointment(queryClient, a.id, { status: "in_consultation" });
		try {
			await api(`/appointments/${a.id}/status`, {
				method: "POST",
				body: JSON.stringify({ status: "in_consultation" }),
			});
			toast.success(panel("statusChanged", { status: statusLabel("in_consultation").toLowerCase() }));
		} catch (err) {
			undo();
			toast.error(err instanceof Error ? err.message : panel("statusError"));
		} finally {
			setCalling(null);
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
		}
	}

	if (isPending) {
		return (
			<div className="bg-card grid gap-2 rounded-xl border p-4">
				{[0, 1, 2].map((i) => (
					<Skeleton key={i} className="h-10 w-full" />
				))}
			</div>
		);
	}

	if (isError) return <p className="text-destructive text-sm">{t("loadError")}</p>;

	if (waiting.length === 0) {
		return (
			<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center">
				<LuArmchair className="text-muted-foreground size-6" />
				<p className="font-medium">{t("empty")}</p>
				<p className="text-muted-foreground max-w-sm text-sm">{t("emptyHint")}</p>
			</div>
		);
	}

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
								<TableCell className="text-end">
									<Button size="sm" disabled={calling !== null} onClick={() => call(a)}>
										<LuDoorOpen /> {panel("call")}
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
