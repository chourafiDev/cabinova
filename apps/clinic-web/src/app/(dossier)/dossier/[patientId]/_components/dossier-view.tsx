"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef, useState } from "react";
import {
	LuArrowLeft,
	LuCalendarClock,
	LuSignature,
	LuFileText,
	LuFlaskConical,
	LuHistory,
	LuMessageSquareText,
	LuPill,
	LuReceipt,
	LuStethoscope,
	LuTimer,
	LuTriangleAlert,
	LuWallet,
} from "react-icons/lu";
import { CheckoutDialog } from "@/app/(clinic)/payments/_components/checkout-dialog";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { NoShowBadge } from "@/components/no-show-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import type { PastConsultation, Visit } from "@/lib/consultations";
import { initials } from "@/lib/format";
import { ageOf, formatFileNumber, fullName, type PatientFile } from "@/lib/patients";
import type { PastPrescription, Prescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { toPoint, type VitalSigns, vitalsKey } from "@/lib/vitals";
import { ConsultationDraft, ConsultationSections, type WorkspaceHandle } from "./consultation-workspace";
import { FinishButton } from "./finish-button";
import { HistoryPanel } from "./history-panel";
import { Card, MedicalCard, PatientAside } from "./patient-aside";
import { PermanentNote, VisitReminder } from "./patient-notes";
import { PrescriptionEditor } from "./prescription-editor";
import { SaveStatus, type SaveState } from "./save-status";
import { Planned } from "./planned";
import type { Point } from "./trends-card";
import { consultationVitals, LatestVitals, type VitalsEntry } from "./vitals-history";

/**
 * The doctor's page for one patient, in three parts that each scroll on
 * their own on a wide screen. Left: who the patient is and their latest
 * constantes. Centre: today's consultation, tab by tab (saved as the doctor
 * types). Right: today at a glance and the notes that follow the patient.
 */
export function DossierView({ patientId, visitId }: { patientId: string; visitId: string | null }) {
	const t = useTranslations("dossier");
	const common = useTranslations("common");
	const format = useFormat();
	const workspace = useRef<WorkspaceHandle>(null);
	const prescriptionEditor = useRef<WorkspaceHandle>(null);
	const [tab, setTab] = useQueryState("onglet", TAB.withOptions({ history: "replace" }));
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
	const [checkout, setCheckout] = useState(false);

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
	const prescription = useQuery({
		queryKey: ["prescription-visit", visitId],
		queryFn: () =>
			api<{ prescription: Prescription | null }>(`/prescriptions/visit/${visitId}`).then((r) => r.prescription),
		enabled: !!visitId,
	});
	const recorded = useQuery({
		queryKey: vitalsKey(patientId),
		queryFn: () => api<VitalSigns[]>(`/patients/${patientId}/vitals`),
	});
	const prescriptions = useQuery({
		queryKey: ["prescriptions", patientId],
		queryFn: () => api<PastPrescription[]>(`/prescriptions?patientId=${patientId}`),
	});

	const p = patient.data;
	const appointment = visit.data?.appointment;
	const allergies = p?.medicalProfile?.allergies;
	const age = p ? ageOf(p.birthDate) : null;
	// Past visits (newest first), and the curves' points: those, then today's as saved.
	const past = history.data?.filter((c) => c.appointmentId !== visitId);
	const current = visit.data?.consultation;
	const pastPrescriptions = prescriptions.data?.filter((r) => r.appointmentId !== visitId);
	const lines = prescription.data?.items.length ?? 0;
	// Front-desk measurements join the curves, in date order with the visits.
	const points: Point[] = [
		...(past ?? []).toReversed(),
		...(current && appointment ? [{ ...current, date: appointment.startsAt }] : []),
		...(recorded.data ?? []).map(toPoint),
	].sort((a, b) => a.date.localeCompare(b.date));
	// Every measurement, newest first: the team's and the consultations'.
	const measurements: VitalsEntry[] = [
		...(recorded.data ?? []).map((vitals) => ({ source: "staff" as const, vitals })),
		...(past ?? []).map((c) => consultationVitals(c, c.date, c.practitioner)),
		...(current && appointment ? [consultationVitals(current, appointment.startsAt, appointment.practitioner.name)] : []),
	]
		.filter((e) => e !== null)
		.sort((a, b) => b.vitals.measuredAt.localeCompare(a.vitals.measuredAt));

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

	const ready = !!visitId && !!visit.data && !prescription.isPending && !prescription.isError;
	/** What needs today's visit: shown once it is loaded, or why it can't be. */
	const withVisit = (content: React.ReactNode) =>
		ready ? (
			content
		) : !visitId ? (
			<NoVisit />
		) : visit.isPending || prescription.isPending ? (
			<Skeleton className="h-40 rounded-xl" />
		) : (
			<p className="text-destructive text-sm">{t("visitError")}</p>
		);

	const tabs: { value: Tab; icon: React.ComponentType; label: string; badge?: number }[] = [
		{ value: "interrogatoire", icon: LuMessageSquareText, label: t("tabs.interrogatoire") },
		{ value: "certificat", icon: LuSignature, label: t("tabs.certificat") },
		{ value: "prix", icon: LuReceipt, label: t("tabs.prix") },
		{ value: "ordonnance", icon: LuPill, label: t("tabs.prescription"), badge: lines },
		{ value: "bilan", icon: LuFlaskConical, label: t("tabs.bilan") },
		{ value: "compte-rendu", icon: LuFileText, label: t("tabs.compteRendu") },
		{ value: "historique", icon: LuHistory, label: t("tabs.historique") },
	];

	const page = (
		<main className="mx-auto grid w-full max-w-[1700px] grid-cols-1 gap-4 px-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[376px_minmax(0,1fr)]">
			<div className="no-scrollbar order-2 grid grid-cols-1 content-start gap-4 pb-4 xl:order-1 xl:overflow-y-auto xl:border-e xl:py-4 xl:pe-4">
				{p && <PatientAside patient={p} />}
				<LatestVitals entries={measurements} points={points} loading={recorded.isPending || history.isPending} />
			</div>

			<section className="no-scrollbar order-1 min-w-0 xl:order-2 xl:overflow-y-auto" aria-label={t("consultation")}>
				<Tabs value={tab} onValueChange={(v) => void setTab(v as Tab)} className="gap-4 pb-4">
					{/* The tabs stay at the top while the consultation scrolls under them. */}
					<div className="bg-background no-scrollbar sticky top-0 z-10 overflow-x-auto pt-4 pb-1">
						<TabsList className="w-full min-w-max justify-start">
							{tabs.map(({ value, icon: Icon, label, badge }) => (
								<TabsTrigger key={value} value={value} className="flex-none px-3">
									<Icon /> {label}
									{!!badge && (
										<span className="bg-primary/12 text-primary rounded px-1.5 text-xs tabular-nums">{badge}</span>
									)}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					{/* Interrogatoire then examen, as the doctor goes through them. */}
					<TabsContent value="interrogatoire" className="grid gap-4">
						{/* What the doctor must not miss: the last visit's reminder, the permanent note. */}
						<VisitReminder last={visitId ? past?.[0] : undefined} />
						{p && <PermanentNote patient={p} />}
						{withVisit(<ConsultationSections sections={["complaint"]} />)}
						{p && <MedicalCard patient={p} />}
						{ready && (
							<ConsultationSections sections={["vitals", "examination", "diagnosis", "plan", "nextVisit"]} />
						)}
					</TabsContent>
					<TabsContent value="certificat">
						<Planned fields={[t("planned.certificat.oneDay"), t("planned.certificat.period"), t("planned.certificat.content")]} />
					</TabsContent>
					<TabsContent value="prix">
						{withVisit(
							<Card icon={LuReceipt} title={t("price.title")}>
								<p className="text-muted-foreground text-sm">{t("price.hint")}</p>
								<Button className="w-fit" onClick={() => setCheckout(true)}>
									<LuWallet /> {t("price.open")}
								</Button>
							</Card>,
						)}
					</TabsContent>
					{/* Kept mounted: switching tabs never loses the medications being typed. */}
					<TabsContent value="ordonnance" forceMount className="data-[state=inactive]:hidden">
						{withVisit(
							visit.data && (
								<PrescriptionEditor
									ref={prescriptionEditor}
									key={visit.data.appointment.id}
									appointmentId={visit.data.appointment.id}
									prescription={prescription.data ?? null}
									previous={pastPrescriptions?.[0]}
									onSaveState={setSaveState}
								/>
							),
						)}
					</TabsContent>
					<TabsContent value="bilan">
						<Planned fields={[t("planned.bilan")]} />
					</TabsContent>
					<TabsContent value="compte-rendu">
						<Planned fields={[t("planned.compteRendu")]} />
					</TabsContent>
					<TabsContent value="historique">
						<HistoryPanel consultations={past} prescriptions={pastPrescriptions} loading={history.isPending} />
					</TabsContent>
				</Tabs>
			</section>

		</main>
	);

	return (
		<div className="flex min-h-svh flex-col xl:h-svh xl:overflow-hidden">
			<header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
				<div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
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
							<FinishButton
								appointment={appointment}
								beforeFinish={async () => {
									const [notes, rx] = await Promise.all([
										workspace.current?.flush() ?? true,
										prescriptionEditor.current?.flush() ?? true,
									]);
									return notes && rx;
								}}
							/>
						)}
					</div>
				</div>

				{allergies && (
					<div className="border-t border-red-200 bg-red-50 text-red-900">
						<p className="mx-auto flex max-w-[1700px] items-start gap-2 px-4 py-2 text-sm">
							<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
							<span>
								<span className="font-semibold">{t("allergies")} </span>
								{allergies}
							</span>
						</p>
					</div>
				)}
			</header>

			{ready && visit.data ? (
				// One draft for every part of today's consultation, wherever the tabs put it.
				<ConsultationDraft
					ref={workspace}
					key={visit.data.appointment.id}
					visit={visit.data}
					previous={history.data?.find((c) => c.appointmentId !== visitId)}
					onSaveState={setSaveState}
				>
					{page}
				</ConsultationDraft>
			) : (
				page
			)}
			{appointment && (
				<CheckoutDialog appointmentId={checkout ? appointment.id : null} onOpenChange={(open) => !open && setCheckout(false)} />
			)}
		</div>
	);
}

const TABS = [
	"interrogatoire",
	"certificat",
	"prix",
	"ordonnance",
	"bilan",
	"compte-rendu",
	"historique",
] as const;
const TAB = parseAsStringLiteral(TABS).withDefault("interrogatoire");
type Tab = (typeof TABS)[number];

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
