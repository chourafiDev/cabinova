"use client";

import { useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import {
	IconClock,
	IconFolderOpen,
	IconMoreVertical,
	IconPlus,
	IconSearch,
	IconStethoscope,
	IconTimer,
} from "@/components/icons";
import { NoShowBadge } from "@/components/no-show-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import {
	type Appointment,
	APPOINTMENTS_KEY,
	type AppointmentStatus,
	patchAppointment,
	type Practitioner,
} from "@/lib/appointments";
import { dossierHref, formatFileNumber, fullName, isMedicalRole, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { useWaitingActions } from "@/lib/use-waiting-actions";
import { useToday } from "./use-today";
import { WalkInSheet } from "./walk-in-sheet";

const COLUMNS = ["scheduled", "confirmed", "arrived", "in_consultation", "completed"] as const;
type Column = (typeof COLUMNS)[number];

/** The column's dot, the agenda's colour for that status. */
const DOT: Record<Column, string> = {
	scheduled: "bg-blue-600",
	confirmed: "bg-purple-600",
	arrived: "bg-amber-500",
	in_consultation: "bg-orange-500",
	completed: "bg-green-600",
};

/** Waiting this long is shown in amber, then red (same as the waiting room). */
const LONG_WAIT = 20;
const VERY_LONG_WAIT = 45;

const DOCTOR_STEPS: AppointmentStatus[] = ["in_consultation", "completed"];
const DRAG_TYPE = "application/x-cabinova-appointment";

/**
 * Where a card may go. The desk moves patients between planned, confirmed
 * and waiting; only a doctor takes one in (or sends them back to wait).
 * "Terminé" is never a drop: the visit ends in the dossier, where the notes
 * are saved first.
 */
function canMove(a: Appointment, to: Column, doctor: boolean) {
	if (a.status === to || to === "completed") return false;
	if (!COLUMNS.includes(a.status as Column) || a.status === "completed") return false;
	if (!doctor && (DOCTOR_STEPS.includes(a.status) || DOCTOR_STEPS.includes(to))) return false;
	// A walk-in was never booked: it can't go back to "planned".
	if (a.walkIn && (to === "scheduled" || to === "confirmed")) return false;
	return true;
}

const byTime = (a: Appointment, b: Appointment) => a.startsAt.localeCompare(b.startsAt);
const byArrival = (a: Appointment, b: Appointment) => (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? "");
const byCompleted = (a: Appointment, b: Appointment) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
const SORT: Record<Column, (a: Appointment, b: Appointment) => number> = {
	scheduled: byTime,
	confirmed: byTime,
	arrived: byArrival,
	in_consultation: byArrival,
	completed: byCompleted,
};

const initials = (name: string) =>
	name
		.replace(/^(Dr\.?|Pr\.?)\s+/i, "")
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");

/**
 * Today's patient flow as a board: one column per step, a card per visit.
 * Dragging a card (or its menu, for touch and keyboard) changes the status,
 * the same move as in the agenda and the waiting room.
 */
export function FlowBoard({ practitioners }: { practitioners: Practitioner[] }) {
	const t = useTranslations("agenda.board");
	const status = useTranslations("common.appointmentStatus");
	const panel = useTranslations("agenda.panel");
	const queryClient = useQueryClient();
	const router = useRouter();
	const doctor = isMedicalRole(useCurrentUser().role);
	const { data, isPending, isError } = useToday();
	const [search, setSearch] = useState("");
	const [practitioner, setPractitioner] = useState("all");
	const [dragging, setDragging] = useState<Appointment | null>(null);
	const [over, setOver] = useState<Column | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const actions = useWaitingActions();

	const columns = useMemo(() => {
		const q = search.trim().toLowerCase();
		const visible = (data ?? []).filter(
			(a) =>
				(practitioner === "all" || a.practitioner.id === practitioner) &&
				(!q ||
					fullName(a.patient).toLowerCase().includes(q) ||
					formatFileNumber(a.patient.fileNumber).toLowerCase().includes(q)),
		);
		return Object.fromEntries(COLUMNS.map((c) => [c, visible.filter((a) => a.status === c).sort(SORT[c])])) as Record<
			Column,
			Appointment[]
		>;
	}, [data, search, practitioner]);

	async function move(a: Appointment, to: Column) {
		if (!canMove(a, to, doctor) || busy) return;
		setBusy(a.id);
		const now = new Date().toISOString();
		const undo = patchAppointment(queryClient, a.id, {
			status: to,
			arrivedAt: to === "scheduled" || to === "confirmed" ? null : (a.arrivedAt ?? now),
			consultationStartedAt: to === "in_consultation" ? (a.consultationStartedAt ?? now) : a.consultationStartedAt,
		});
		try {
			await api(`/appointments/${a.id}/status`, {
				method: "POST",
				body: JSON.stringify({ status: to }),
			});
			const message = panel("statusChanged", {
				status: status(to).toLowerCase(),
			});
			if (to === "in_consultation") {
				toast.success(message, {
					action: {
						label: panel("openFile"),
						onClick: () => router.push(dossierHref(a.patient.id, a.id)),
					},
				});
			} else {
				toast.success(message);
			}
		} catch (err) {
			undo();
			toast.error(err instanceof Error ? err.message : panel("statusError"));
		} finally {
			setBusy(null);
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
		}
	}

	const total = COLUMNS.reduce((n, c) => n + columns[c].length, 0);

	return (
		<div className="grid min-w-0 gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-full sm:w-64">
					<IconSearch className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("search")}
						aria-label={t("search")}
						className="ps-8"
					/>
				</div>
				{practitioners.length > 1 && (
					<Select value={practitioner} onValueChange={setPractitioner}>
						<SelectTrigger className="w-full sm:w-52" aria-label={t("practitioner")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("allPractitioners")}</SelectItem>
							{practitioners.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				<p className="text-muted-foreground text-sm sm:ms-auto">{!isPending && t("count", { count: total })}</p>
			</div>

			{isError ? (
				<p className="text-destructive text-sm">{t("loadError")}</p>
			) : (
				<div className="-mx-1 overflow-x-auto px-1 pb-2">
					<div className="grid auto-cols-[minmax(12.5rem,1fr)] grid-flow-col gap-3">
						{COLUMNS.map((column) => {
							const cards = columns[column];
							const droppable = !!dragging && canMove(dragging, column, doctor);
							return (
								<section
									key={column}
									aria-label={status(column)}
									onDragOver={(e) => {
										if (!droppable) return;
										e.preventDefault();
										e.dataTransfer.dropEffect = "move";
										if (over !== column) setOver(column);
									}}
									onDragLeave={(e) => {
										if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
									}}
									onDrop={(e) => {
										e.preventDefault();
										setOver(null);
										if (dragging) void move(dragging, column);
									}}
									className={cn(
										"bg-muted/50 flex min-h-[28rem] min-w-0 flex-col gap-2 rounded-xl border border-transparent p-2 transition-colors",
										dragging && !droppable && dragging.status !== column && "opacity-60",
										droppable && "border-primary/30 border-dashed",
										over === column && "border-primary bg-primary/5",
									)}
								>
									<header className="flex items-center gap-2 px-1.5 pt-1 pb-1">
										<span className={cn("size-2 shrink-0 rounded-full", DOT[column])} />
										<h2 className="truncate text-sm font-semibold">
											{column === "arrived" ? t("waiting") : status(column)}
										</h2>
										<span className="bg-background text-muted-foreground rounded-full border px-1.5 text-xs font-medium tabular-nums">
											{cards.length}
										</span>
										{column === "arrived" && (
											<Button
												size="icon-sm"
												variant="ghost"
												className="-my-1.5 ms-auto size-7"
												aria-label={t("walkIn")}
												title={t("walkIn")}
												onClick={() => setAdding(true)}
											>
												<IconPlus />
											</Button>
										)}
									</header>

									{isPending ? (
										[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
									) : cards.length === 0 ? (
										<p className="text-muted-foreground flex flex-1 items-start justify-center px-3 pt-8 text-center text-xs">
											{over === column ? t("dropHere") : t(`empty.${column}`)}
										</p>
									) : (
										<ul className="grid grid-cols-1 gap-2">
											{cards.map((a) => (
												<FlowCard
													key={a.id}
													appointment={a}
													doctor={doctor}
													busy={busy === a.id || actions.busy === a.id}
													dragging={dragging?.id === a.id}
													onDragStart={() => setDragging(a)}
													onDragEnd={() => {
														setDragging(null);
														setOver(null);
													}}
													targets={COLUMNS.filter((c) => canMove(a, c, doctor))}
													onMove={(to) => void move(a, to)}
													onOpenFile={() => void actions.openFile(a)}
												/>
											))}
										</ul>
									)}
								</section>
							);
						})}
					</div>
				</div>
			)}

			<WalkInSheet practitioners={practitioners} open={adding} onOpenChange={setAdding} />
		</div>
	);
}

function FlowCard({
	appointment: a,
	doctor,
	busy,
	dragging,
	targets,
	onDragStart,
	onDragEnd,
	onMove,
	onOpenFile,
}: {
	appointment: Appointment;
	doctor: boolean;
	busy: boolean;
	dragging: boolean;
	targets: Column[];
	onDragStart: () => void;
	onDragEnd: () => void;
	onMove: (to: Column) => void;
	onOpenFile: () => void;
}) {
	const t = useTranslations("agenda.board");
	const waiting = useTranslations("agenda.waiting");
	const status = useTranslations("common.appointmentStatus");
	const panel = useTranslations("agenda.panel");
	const fmt = useFormat();
	const now = useNow();
	const draggable = targets.length > 0 && !busy;

	// The time that matters at this step: how long they've waited, or been in.
	const since =
		a.status === "arrived" && a.arrivedAt
			? Math.max(0, differenceInMinutes(now, new Date(a.arrivedAt)))
			: a.status === "in_consultation" && a.consultationStartedAt
				? Math.max(0, differenceInMinutes(now, new Date(a.consultationStartedAt)))
				: null;
	const late =
		(a.status === "scheduled" || a.status === "confirmed") && differenceInMinutes(now, new Date(a.startsAt)) > 0;

	return (
		<li
			draggable={draggable}
			onDragStart={(e) => {
				e.dataTransfer.setData(DRAG_TYPE, a.id);
				e.dataTransfer.effectAllowed = "move";
				onDragStart();
			}}
			onDragEnd={onDragEnd}
			className={cn(
				"bg-card group grid min-w-0 grid-cols-1 gap-2.5 rounded-lg border p-3 shadow-xs transition",
				draggable && "cursor-grab hover:shadow-sm active:cursor-grabbing",
				dragging && "opacity-40",
				busy && "animate-pulse",
				a.status === "in_consultation" && "border-orange-300 dark:border-orange-800",
			)}
		>
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
						a.walkIn ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-muted text-foreground",
					)}
				>
					{a.walkIn ? waiting("noAppointment") : fmt.clock(a.startsAt)}
				</span>
				{(a.reasonShort || a.reason) && (
					<span className="text-muted-foreground truncate text-xs" title={a.reason ?? undefined}>
						{a.reasonShort ?? a.reason}
					</span>
				)}
				{targets.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon-sm"
								variant="ghost"
								className="ms-auto -me-1.5 size-6 opacity-60 group-hover:opacity-100"
								aria-label={t("moveTo")}
								disabled={busy}
							>
								<IconMoreVertical />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-52">
							<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t("moveTo")}</DropdownMenuLabel>
							{targets.map((c) => (
								<DropdownMenuItem key={c} className="whitespace-nowrap" onSelect={() => onMove(c)}>
									<span className={cn("size-2 rounded-full", DOT[c])} /> {c === "arrived" ? t("waiting") : status(c)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			<div className="min-w-0">
				<Link
					href={patientHref(a.patient.id)}
					draggable={false}
					className="block truncate text-sm font-semibold hover:underline"
				>
					{fullName(a.patient)}
				</Link>
				<div className="mt-0.5 flex items-center gap-1.5">
					<span className="text-muted-foreground font-mono text-xs">{formatFileNumber(a.patient.fileNumber)}</span>
					<NoShowBadge count={a.patient.noShows} />
				</div>
			</div>

			<div className="flex items-center gap-2 border-t pt-2.5">
				<Avatar className="size-6" title={a.practitioner.name}>
					<AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
						{initials(a.practitioner.name)}
					</AvatarFallback>
				</Avatar>
				<span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{a.practitioner.name}</span>
				{since !== null ? (
					<span
						className={cn(
							"flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
							a.status === "in_consultation"
								? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
								: since >= VERY_LONG_WAIT
									? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
									: since >= LONG_WAIT
										? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
										: "bg-muted text-muted-foreground",
						)}
					>
						{a.status === "in_consultation" ? <IconTimer className="size-3" /> : <IconClock className="size-3" />}
						{since < 1 ? waiting("justNow") : fmt.duration(since)}
					</span>
				) : a.status === "completed" && a.completedAt ? (
					<span className="text-muted-foreground text-xs tabular-nums">
						{t("doneAt", { time: fmt.clock(a.completedAt) })}
					</span>
				) : late ? (
					<span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
						{t("late")}
					</span>
				) : null}
			</div>

			{doctor && a.status === "in_consultation" && (
				<Button asChild size="sm" className="h-7 min-w-0 text-xs">
					<Link href={dossierHref(a.patient.id, a.id)} draggable={false}>
						<IconStethoscope /> <span className="truncate">{waiting("resume")}</span>
					</Link>
				</Button>
			)}
			{doctor && a.status === "arrived" && (
				// Opening a waiting patient's file takes them in, as in the waiting room.
				<Button size="sm" variant="outline" className="h-7 min-w-0 text-xs" disabled={busy} onClick={onOpenFile}>
					<IconFolderOpen /> <span className="truncate">{panel("openFile")}</span>
				</Button>
			)}
		</li>
	);
}
