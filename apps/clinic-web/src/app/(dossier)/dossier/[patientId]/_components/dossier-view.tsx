"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useRef, useState } from "react";
import { DocumentsTab } from "@/app/(clinic)/patients/_components/documents-tab";
import { PatientSheet } from "@/app/(clinic)/patients/_components/patient-sheet";
import { CheckoutPanel } from "@/app/(clinic)/payments/_components/checkout-dialog";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import {
	IconArrowLeft,
	IconCalendarClock,
	IconClipboard,
	IconDocument,
	IconFolderOpen,
	IconLab,
	IconMail,
	IconMessage,
	IconPill,
	IconReceipt,
	IconSignature,
	IconStethoscope,
	IconTimer,
} from "@/components/icons";
import { NoShowBadge } from "@/components/no-show-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { documentsKey, type PatientDocument } from "@/lib/documents";
import { type LabResult, labResultsKey } from "@/lib/lab-results";
import type { PastConsultation, Visit } from "@/lib/consultations";
import {
	ageOf,
	formatFileNumber,
	fullName,
	type PatientFile,
} from "@/lib/patients";
import type { PastPrescription, Prescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { useNow } from "@/lib/use-now";
import { toPoint, type VitalSigns, vitalsKey } from "@/lib/vitals";
import { PatientNoteCard } from "./antecedents-card";
import { BackToWaitingRoom } from "./back-to-waiting-room";
import { BilanTab } from "./bilan-tab";
import { type DossierTab, DossierTabs } from "./dossier-tabs";
import { BookAppointment, type BookingSettings } from "./book-appointment";
import { CertificateTab } from "./certificate-tab";
import { ClinicalAlerts } from "./clinical-alerts";
import {
	ConsultationDraft,
	ConsultationSections,
	type WorkspaceHandle,
} from "./consultation-workspace";
import { FinishButton } from "./finish-button";
import { LabRequestTab } from "./lab-request-tab";
import { PrintMenu, RenewButton, ShortcutsHelp } from "./header-actions";
import { LettersTab } from "./letters-tab";
import { PatientAside } from "./patient-aside";
import { PaymentHistory } from "./payment-history";
import { PrescriptionEditor, type PrescriptionHandle } from "./prescription-editor";
import { PrescriptionHistory } from "./prescription-history";
import { type SaveState, SaveStatus } from "./save-status";
import type { Point } from "./trends-card";
import {
	consultationVitals,
	LatestVitals,
	type VitalsEntry,
} from "./vitals-history";

/**
 * The doctor's page for one patient, in three parts that each scroll on
 * their own on a wide screen. Left: who the patient is and their latest
 * constantes. Centre: today's consultation, tab by tab (saved as the doctor
 * types). Right: today at a glance and the notes that follow the patient.
 */
export function DossierView({
	patientId,
	visitId,
	booking,
}: {
	patientId: string;
	visitId: string | null;
	/** For the "Rendez-vous" dialog: practitioners, opening hours, defaults. */
	booking: BookingSettings;
}) {
	const t = useTranslations("dossier");
	const common = useTranslations("common");
	const format = useFormat();
	const workspace = useRef<WorkspaceHandle>(null);
	const prescriptionEditor = useRef<PrescriptionHandle>(null);
	const [tab, setTab] = useQueryState(
		"onglet",
		TAB.withOptions({ history: "replace" }),
	);
	const selectTab = useCallback((value: Tab) => void setTab(value), [setTab]);
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
	// Per tab, for its marker: the notes' and the ordonnance's saves, and the drafts not saved yet.
	const [notesState, setNotesState] = useState<SaveState["status"]>("idle");
	const [rxState, setRxState] = useState<SaveState["status"]>("idle");
	const [unsaved, setUnsaved] = useState<Partial<Record<Tab, boolean>>>({});
	const markUnsaved = useCallback(
		(value: Tab) => (dirty: boolean) => setUnsaved((u) => (u[value] === dirty ? u : { ...u, [value]: dirty })),
		[],
	);
	const onNotesState = useCallback((state: SaveState) => {
		setSaveState(state);
		setNotesState(state.status);
	}, []);
	const onRxState = useCallback((state: SaveState) => {
		setSaveState(state);
		setRxState(state.status);
	}, []);

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
		queryFn: () =>
			api<PastConsultation[]>(`/consultations?patientId=${patientId}`),
	});
	const prescription = useQuery({
		queryKey: ["prescription-visit", visitId],
		queryFn: () =>
			api<{ prescription: Prescription | null }>(
				`/prescriptions/visit/${visitId}`,
			).then((r) => r.prescription),
		enabled: !!visitId,
	});
	const recorded = useQuery({
		queryKey: vitalsKey(patientId),
		queryFn: () => api<VitalSigns[]>(`/patients/${patientId}/vitals`),
	});
	const prescriptions = useQuery({
		queryKey: ["prescriptions", patientId],
		queryFn: () =>
			api<PastPrescription[]>(`/prescriptions?patientId=${patientId}`),
	});

	// The tabs' counts (the same queries as the tabs, so they share the cache).
	const documents = useQuery({
		queryKey: documentsKey(patientId),
		queryFn: () => api<PatientDocument[]>(`/patients/${patientId}/documents`),
	});
	const labResults = useQuery({
		queryKey: labResultsKey(patientId),
		queryFn: () => api<LabResult[]>(`/patients/${patientId}/lab-results`),
	});
	
	const p = patient.data;
	const appointment = visit.data?.appointment;
	const age = p ? ageOf(p.birthDate) : null;
	// Past visits (newest first), and the curves' points: those, then today's as saved.
	const past = history.data?.filter((c) => c.appointmentId !== visitId);
	const current = visit.data?.consultation;
	const pastPrescriptions = prescriptions.data?.filter(
		(r) => r.appointmentId !== visitId,
	);
	const lines = prescription.data?.items.length ?? 0;
	// Front-desk measurements join the curves, in date order with the visits.
	const points: Point[] = [
		...(past ?? []).toReversed(),
		...(current && appointment
			? [{ ...current, date: appointment.startsAt }]
			: []),
		...(recorded.data ?? []).map(toPoint),
	].sort((a, b) => a.date.localeCompare(b.date));
	// Every measurement, newest first: the team's and the consultations'.
	const measurements: VitalsEntry[] = [
		...(recorded.data ?? []).map((vitals) => ({
			source: "staff" as const,
			vitals,
		})),
		...(past ?? []).map((c) => consultationVitals(c, c.date, c.practitioner)),
		...(current && appointment
			? [
					consultationVitals(
						current,
						appointment.startsAt,
						appointment.practitioner.name,
					),
				]
			: []),
	]
		.filter((e) => e !== null)
		.sort((a, b) => b.vitals.measuredAt.localeCompare(a.vitals.measuredAt));

	/** Saves what is still being typed (notes, ordonnance): false when it can't be. */
	const flush = async () => {
		const [notes, rx] = await Promise.all([
			workspace.current?.flush() ?? true,
			prescriptionEditor.current?.flush() ?? true,
		]);
		return notes && rx;
	};

	// Back where the doctor came from: the waiting room for a visit, else the patient list.
	const back = visitId
		? { href: "/appointments", label: t("back") }
		: { href: "/patients", label: t("backToPatients") };

	if (patient.isError) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="font-medium">{t("notFound")}</p>
				<Button asChild variant="outline">
					<Link href={back.href}>{back.label}</Link>
				</Button>
			</div>
		);
	}

	const ready =
		!!visitId &&
		!!visit.data &&
		!prescription.isPending &&
		!prescription.isError;
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

	const savingDot = (status: SaveState["status"]) =>
		status === "error" ? ("error" as const) : status === "saving" ? ("pending" as const) : undefined;
	const draftDot = (value: Tab) => (unsaved[value] ? ("pending" as const) : undefined);
	const tabs: DossierTab<Tab>[] = [
		{ value: "interrogatoire", icon: IconMessage, label: t("tabs.interrogatoire"), dot: savingDot(notesState) },
		{ value: "bilan", icon: IconClipboard, label: t("tabs.bilan"), badge: labResults.data?.length },
		{ value: "documents", icon: IconFolderOpen, label: t("tabs.documents"), badge: documents.data?.length },
		{ value: "certificat", icon: IconSignature, label: t("tabs.certificat") },
		{ value: "bilan-biologique", icon: IconLab, label: t("tabs.bilanBiologique"), dot: draftDot("bilan-biologique") },
		{ value: "prix", icon: IconReceipt, label: t("tabs.prix") },
		{ value: "ordonnance", icon: IconPill, label: t("tabs.prescription"), badge: lines, dot: savingDot(rxState) },
		{ value: "compte-rendu", icon: IconDocument, label: t("tabs.compteRendu"), dot: draftDot("compte-rendu") },
		{ value: "lettres", icon: IconMail, label: t("tabs.lettres"), dot: draftDot("lettres") },
	];
	const page = (
		<main className="mx-auto grid w-full max-w-[1700px] grid-cols-1 gap-4 px-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[376px_minmax(0,1fr)]">
			<div className="no-scrollbar order-2 grid grid-cols-1 content-start gap-4 pb-4 xl:order-1 xl:overflow-y-auto xl:border-e xl:py-4 xl:pe-4">
				{p && <PatientAside patient={p} />}
				<LatestVitals
					entries={measurements}
					points={points}
					loading={recorded.isPending || history.isPending}
				/>
			</div>

			<section
				className="no-scrollbar order-1 min-w-0 xl:order-2 xl:overflow-y-auto"
				aria-label={t("consultation")}
			>
				<Tabs
					value={tab}
					onValueChange={(v) => void setTab(v as Tab)}
					className="gap-4 pb-4"
				>
					{/* The tabs stay at the top while the consultation scrolls under them. */}
					<div className="bg-background sticky top-0 z-10 pt-4 pb-1">
						<DossierTabs tabs={tabs} current={tab} onSelect={selectTab} />
					</div>

					{/* Motif, antécédents, observation, diagnostic, then the treatments already given. */}
					<TabsContent value="interrogatoire" className="grid gap-4">
						{withVisit(<ConsultationSections sections={["complaint"]} />)}
						{p && (
							<PatientNoteCard
								key={`${p.id}-antecedents`}
								patient={p}
								field="antecedents"
							/>
						)}
						{ready && (
							<ConsultationSections sections={["examination", "diagnosis"]} />
						)}
						{p && (
							<PatientNoteCard
								key={`${p.id}-note`}
								patient={p}
								field="permanentNote"
							/>
						)}
						<PrescriptionHistory
							prescriptions={pastPrescriptions}
							title={t("sections.treatment")}
						/>
					</TabsContent>
					{/* The same documents as the patient's file: the doctor adds, opens and removes them here too. */}
					<TabsContent value="documents">
						{p && <DocumentsTab patientId={p.id} archived={!!p.archivedAt} />}
					</TabsContent>
					<TabsContent value="certificat">
						{p && (
							<CertificateTab
								patient={p}
								appointmentId={
									visitId && visit.data ? visit.data.appointment.id : null
								}
							/>
						)}
					</TabsContent>
					{/* Kept mounted, like the ordonnance: a draft survives switching tabs. */}
					<TabsContent value="bilan-biologique" forceMount className="data-[state=inactive]:hidden">
						{p && (
							<LabRequestTab
								onUnsavedChange={markUnsaved("bilan-biologique")}
								patient={p}
								appointmentId={
									visitId && visit.data ? visit.data.appointment.id : null
								}
							/>
						)}
					</TabsContent>
					<TabsContent value="prix">
						{/* The acts and the payment, right here: no dialog over the consultation. Outside a visit, what was paid. */}
						{visitId ? (
							withVisit(
								appointment && (
									<div className="bg-card rounded-xl border p-5">
										<CheckoutPanel appointmentId={appointment.id} />
									</div>
								),
							)
						) : (
							<PaymentHistory patientId={patientId} />
						)}
					</TabsContent>
					{/* Kept mounted: switching tabs never loses the medications being typed. Outside a visit, the past ones. */}
					<TabsContent
						value="ordonnance"
						forceMount
						className="data-[state=inactive]:hidden"
					>
						{visitId ? (
							withVisit(
								visit.data && (
									<PrescriptionEditor
										ref={prescriptionEditor}
										key={visit.data.appointment.id}
										appointmentId={visit.data.appointment.id}
										prescription={prescription.data ?? null}
										previous={pastPrescriptions?.[0]}
										onSaveState={onRxState}
									/>
								),
							)
						) : (
							<PrescriptionHistory prescriptions={prescriptions.data} />
						)}
					</TabsContent>
					<TabsContent value="bilan">
						<BilanTab
							patientId={patientId}
							appointmentId={visitId ? (appointment?.id ?? null) : null}
						/>
					</TabsContent>
					<TabsContent value="compte-rendu" forceMount className="data-[state=inactive]:hidden">
						{p && (
							<LettersTab
								onUnsavedChange={markUnsaved("compte-rendu")}
								kind="report"
								patient={p}
								appointmentId={
									visitId && visit.data ? visit.data.appointment.id : null
								}
							/>
						)}
					</TabsContent>
					<TabsContent value="lettres" forceMount className="data-[state=inactive]:hidden">
						{p && (
							<LettersTab
								onUnsavedChange={markUnsaved("lettres")}
								patient={p}
								appointmentId={
									visitId && visit.data ? visit.data.appointment.id : null
								}
							/>
						)}
					</TabsContent>
				</Tabs>
			</section>
		</main>
	);

	return (
		<div className="flex min-h-svh flex-col xl:h-svh xl:overflow-hidden">
			<header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
				{/* Three groups: who (start), what to do (centre), the visit (end). */}
				<div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
					<div className="flex min-w-0 flex-1 basis-80 items-center gap-4">
						{visitId ? (
							<BackToWaitingRoom appointment={appointment} beforeLeave={flush} />
						) : (
							<Button asChild variant="ghost" size="sm" className="-ms-2">
								<Link href={back.href}>
									<IconArrowLeft className="rtl:-scale-x-100" /> {back.label}
								</Link>
							</Button>
						)}
						<span className="bg-border hidden h-8 w-px sm:block" aria-hidden />

						{p ? (
							// Who, in a word (the patient card has the rest), then what must not be missed.
							<div className="grid min-w-0 gap-1">
								<h1 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg leading-tight font-semibold">
									<span className="truncate">{fullName(p)}</span>
									<span className="text-muted-foreground text-xs font-normal tabular-nums">
										{formatFileNumber(p.fileNumber)}
										{age !== null && ` · ${common("age", { age })}`}
									</span>
									<NoShowBadge count={p.noShows} />
								</h1>
								<ClinicalAlerts patient={p} />
							</div>
						) : (
							<div className="grid gap-1.5">
								<Skeleton className="h-5 w-44" />
								<Skeleton className="h-4 w-72" />
							</div>
						)}
					</div>

					<div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
						{p && !p.archivedAt && <BookAppointment patient={p} settings={booking} />}
						{/* The last ordonnance into today's, for a renewal visit. */}
						{ready &&
							appointment &&
							appointment.status !== "completed" &&
							!!pastPrescriptions?.[0]?.items.length && (
								<RenewButton
									date={pastPrescriptions[0].date}
									onRenew={() => {
										prescriptionEditor.current?.renew();
										void setTab("ordonnance");
									}}
								/>
							)}
						{visitId && appointment && (
							<PrintMenu
								patientId={patientId}
								appointmentId={appointment.id}
								prescriptionLines={lines}
								beforePrint={flush}
							/>
						)}
						<div className="h-5 w-px bg-border" />
						<ShortcutsHelp tabs={tabs.map((tab) => tab.label)} />
					</div>

					{/* The visit, on two short lines, so Terminer always stays beside it. */}
					<div className="flex min-w-0 flex-1 basis-80 items-center justify-end gap-3">
						{appointment && (
							<div className="hidden min-w-0 justify-items-end gap-1 text-sm md:grid mt-1">
								<div className="flex items-center gap-2">
									<AppointmentStatusBadge status={appointment.status} />
									{appointment.status === "in_consultation" &&
										appointment.consultationStartedAt && (
											<VisitTimer since={appointment.consultationStartedAt} />
										)}
								</div>
								<div className="flex min-w-0 max-w-full items-center gap-2 text-xs">
									<span className="text-muted-foreground truncate">
										{appointment.walkIn
											? t("walkIn")
											: t("appointmentAt", {
													time: format.clock(appointment.startsAt),
												})}
										{appointment.reason && ` · ${appointment.reason}`}
									</span>
									<SaveStatus state={saveState} />
								</div>
							</div>
						)}
						{/* On a small screen the block above is hidden: the save status stays. */}
						{appointment && (
							<span className="md:hidden">
								<SaveStatus state={saveState} />
							</span>
						)}
						{appointment && (
							<div className="shrink-0">
								<FinishButton appointment={appointment} beforeFinish={flush} />
							</div>
						)}
					</div>
				</div>
			</header>

			{ready && visit.data ? (
				// One draft for every part of today's consultation, wherever the tabs put it.
				<ConsultationDraft
					ref={workspace}
					key={visit.data.appointment.id}
					visit={visit.data}
					previous={history.data?.find((c) => c.appointmentId !== visitId)}
					onSaveState={onNotesState}
				>
					{page}
				</ConsultationDraft>
			) : (
				page
			)}
			{/* The administrative file (?patient=…), opened from the patient section. */}
			<PatientSheet medical withinDossier />
		</div>
	);
}

const TABS = [
	"interrogatoire",
	"bilan",
	"documents",
	"certificat",
	"bilan-biologique",
	"prix",
	"ordonnance",
	"compte-rendu",
	"lettres",
] as const;
const TAB = parseAsStringLiteral(TABS).withDefault("interrogatoire");
type Tab = (typeof TABS)[number];

/** Opened outside a visit (from the patient's file): nothing to write, the history is beside. */
function NoVisit() {
	const t = useTranslations("dossier");
	return (
		<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
			<span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
				<IconStethoscope className="size-5" />
			</span>
			<p className="font-medium">{t("noVisit")}</p>
			<p className="text-muted-foreground max-w-sm text-sm">
				{t("noVisitHint")}
			</p>
			<Button asChild variant="outline" size="sm" className="mt-2">
				<Link href="/appointments">
					<IconCalendarClock /> {t("toWaitingRoom")}
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
	const minutes = Math.max(
		0,
		Math.floor((now - new Date(since).getTime()) / 60_000),
	);
	return (
		<span
			className="bg-sky-500 text-white flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums"
			title={t("timerTitle")}
		>
			<IconTimer className="size-3.5" />{" "}
			{minutes < 1 ? t("justStarted") : fmt.duration(minutes)}
		</span>
	);
}
