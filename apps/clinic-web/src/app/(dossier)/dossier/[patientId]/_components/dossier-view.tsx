"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LuArrowLeft, LuCalendarClock, LuStethoscope, LuTimer, LuTriangleAlert } from "react-icons/lu";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { NoShowBadge } from "@/components/no-show-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { Appointment } from "@/lib/appointments";
import type { PastConsultation, Visit } from "@/lib/consultations";
import { initials } from "@/lib/format";
import { ageOf, formatFileNumber, fullName, type PatientFile } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { ConsultationWorkspace, type WorkspaceHandle } from "./consultation-workspace";
import { FinishButton } from "./finish-button";
import { HistoryPanel } from "./history-panel";
import { PatientNotes } from "./patient-notes";
import { type Point, TrendsCard } from "./trends-card";
import { PatientAside } from "./patient-aside";
import { SaveStatus, type SaveState } from "./save-status";

/**
 * The doctor's page for one patient. Top: who they are and today's visit.
 * Middle: the consultation being written (saved as the doctor types).
 * Around it: the antécédents and contact on the left, past visits on the right.
 */
export function DossierView({ patientId, visitId }: { patientId: string; visitId: string | null }) {
	const t = useTranslations("dossier");
	const common = useTranslations("common");
	const format = useFormat();
	const workspace = useRef<WorkspaceHandle>(null);
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

	const patient = useQuery({
		queryKey: ["patient", patientId],
		queryFn: () => api<PatientFile>(`/patients/${patientId}`),
	});
	const visit = useQuery({
		queryKey: ["consultation-visit", visitId],
		queryFn: () => api<Visit>(`/consultations/visit/${visitId}`),
		enabled: !!visitId,
	});
	const history = useQuery({
		queryKey: ["consultations", patientId],
		queryFn: () => api<PastConsultation[]>(`/consultations?patientId=${patientId}`),
	});
	const appointments = useQuery({
		queryKey: ["patient-appointments", patientId],
		queryFn: () => api<Appointment[]>(`/appointments?patientId=${patientId}`),
	});

	const p = patient.data;
	const appointment = visit.data?.appointment;
	const allergies = p?.medicalProfile?.allergies;
	const age = p ? ageOf(p.birthDate) : null;
	// Past visits (newest first), and the curves' points: those, then today's as saved.
	const past = history.data?.filter((c) => c.appointmentId !== visitId);
	const current = visit.data?.consultation;
	const points: Point[] = [
		...(past ?? []).toReversed(),
		...(current && appointment ? [{ ...current, date: appointment.startsAt }] : []),
	];
	const next = appointments.data
		?.filter((a) => a.id !== visitId && new Date(a.startsAt) > new Date() && ["scheduled", "confirmed"].includes(a.status))
		.at(-1);

	if (patient.isError) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="font-medium">{t("notFound")}</p>
				<Button asChild variant="outline">
					<Link href="/appointments">{t("back")}</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh flex-col">
			<header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
				<div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
					<Button asChild variant="ghost" size="sm" className="-ms-2">
						<Link href="/appointments">
							<LuArrowLeft className="rtl:-scale-x-100" /> {t("back")}
						</Link>
					</Button>
					<span className="bg-border hidden h-8 w-px sm:block" aria-hidden />

					{p ? (
						<div className="flex min-w-0 items-center gap-3">
							<span className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
								{initials(`${p.firstName} ${p.lastName}`)}
							</span>
							<div className="min-w-0">
								<h1 className="flex flex-wrap items-center gap-2 text-lg leading-tight font-semibold">
									<span className="truncate">{fullName(p)}</span>
									<NoShowBadge count={p.noShows} />
								</h1>
								<p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
									<span className="font-mono text-xs">{formatFileNumber(p.fileNumber)}</span>
									<span aria-hidden>·</span>
									<span>
										{common(`sex.${p.sex}`)}
										{age !== null && `, ${common("age", { age })}`}
									</span>
									<span aria-hidden>·</span>
									<span>{common(`coverage.${p.coverage}`)}</span>
								</p>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<Skeleton className="size-11 rounded-xl" />
							<div className="grid gap-1.5">
								<Skeleton className="h-5 w-44" />
								<Skeleton className="h-4 w-56" />
							</div>
						</div>
					)}

					<div className="ms-auto flex flex-wrap items-center gap-3">
						{appointment && (
							<div className="hidden items-center gap-2 text-sm md:flex">
								<AppointmentStatusBadge status={appointment.status} />
								{appointment.status === "in_consultation" && appointment.consultationStartedAt && (
									<VisitTimer since={appointment.consultationStartedAt} />
								)}
								<span className="text-muted-foreground">
									{appointment.walkIn ? t("walkIn") : t("appointmentAt", { time: format.clock(appointment.startsAt) })}
									{appointment.reason && ` · ${appointment.reason}`}
								</span>
							</div>
						)}
						{appointment && <SaveStatus state={saveState} />}
						{appointment && (
							<FinishButton appointment={appointment} beforeFinish={() => workspace.current?.flush() ?? Promise.resolve(true)} />
						)}
					</div>
				</div>

				{allergies && (
					<div className="border-t border-red-200 bg-red-50 text-red-900">
						<p className="mx-auto flex max-w-[1600px] items-start gap-2 px-4 py-2 text-sm">
							<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
							<span>
								<span className="font-semibold">{t("allergies")} </span>
								{allergies}
							</span>
						</p>
					</div>
				)}
			</header>

			<main className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
				<div className="order-2 hidden xl:order-1 xl:block">
					{p && <PatientAside patient={p} next={next} />}
				</div>

				<section className="order-1 grid min-w-0 gap-4 xl:order-2" aria-label={t("consultation")}>
					{p && <PatientNotes patient={p} last={visitId ? past?.[0] : undefined} />}
					{!visitId ? (
						<NoVisit />
					) : visit.isPending ? (
						<div className="grid gap-4">
							<Skeleton className="h-40 rounded-xl" />
							<Skeleton className="h-32 rounded-xl" />
							<Skeleton className="h-56 rounded-xl" />
						</div>
					) : visit.isError || !visit.data ? (
						<p className="text-destructive text-sm">{t("visitError")}</p>
					) : (
						<ConsultationWorkspace
							ref={workspace}
							key={visit.data.appointment.id}
							visit={visit.data}
							previous={history.data?.find((c) => c.appointmentId !== visitId)}
							onSaveState={setSaveState}
						/>
					)}
					{/* Below xl the left column moves under the consultation. */}
					<div className="xl:hidden">{p && <PatientAside patient={p} next={next} />}</div>
				</section>

				<aside className="order-3 grid min-w-0 gap-4">
					<TrendsCard points={points} />
					<HistoryPanel
						consultations={past}
						loading={history.isPending}
					/>
				</aside>
			</main>
		</div>
	);
}

/** Opened outside a visit (from the patient's file): nothing to write, the history is beside. */
function NoVisit() {
	const t = useTranslations("dossier");
	return (
		<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
			<span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
				<LuStethoscope className="size-5" />
			</span>
			<p className="font-medium">{t("noVisit")}</p>
			<p className="text-muted-foreground max-w-sm text-sm">{t("noVisitHint")}</p>
			<Button asChild variant="outline" size="sm" className="mt-2">
				<Link href="/appointments">
					<LuCalendarClock /> {t("toWaitingRoom")}
				</Link>
			</Button>
		</div>
	);
}

/** How long the doctor has been with the patient, kept up to date. */
function VisitTimer({ since }: { since: string }) {
	const t = useTranslations("dossier");
	const fmt = useFormat();
	const now = useNow();
	const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
	return (
		<span className="bg-muted flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums" title={t("timerTitle")}>
			<LuTimer className="size-3.5" /> {minutes < 1 ? t("justStarted") : fmt.duration(minutes)}
		</span>
	);
}
