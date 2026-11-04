"use client";

import Link from "next/link";
import { differenceInMinutes } from "date-fns";
import { useTranslations } from "next-intl";
import { LuArchive, LuArchiveRestore, LuCalendarClock, LuCalendarPlus, LuContactRound, LuEllipsis, LuIdCard, LuMail, LuMapPin, LuPencil, LuPhone, LuShieldCheck, LuStethoscope, LuStickyNote, LuTriangleAlert } from "react-icons/lu";
import { NoShowBadge } from "@/components/no-show-badge";
import { useState } from "react";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment } from "@/lib/appointments";
import { initials } from "@/lib/format";
import { ageOf, dossierHref, formatFileNumber, formatPhone, fullName, type PatientFile } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ArchiveDialog } from "./archive-button";
import { PatientBalance, PatientPayments } from "./patient-payments";
import { MedicalProfile } from "./medical-profile-card";

/** Upcoming vs past appointments (outside render: React Compiler purity). */
const now = () => Date.now();
const ACTIVE = new Set(["scheduled", "confirmed", "arrived", "in_consultation"]);

const dayLabel = (format: ReturnType<typeof useFormat>, iso: string) =>
	format.date(iso, { weekday: "long", day: "numeric", month: "long", year: undefined });

/** Header of the file: identity at a glance, one-click contact, main actions. */
export function PatientHeader({
	patient,
	medical,
	onEdit,
	onArchive,
}: {
	patient: PatientFile;
	/** A doctor: the medical dossier is one click away. */
	medical?: boolean;
	onEdit: () => void;
	onArchive: () => void;
}) {
	const age = ageOf(patient.birthDate);
	const archived = patient.archivedAt !== null;
	const t = useTranslations("patients.details");
	const common = useTranslations("common");

	return (
		<div className="grid gap-4 border-b p-5 pe-12">
			<div className="flex items-start gap-3.5">
				<span
					className={cn(
						"flex size-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold",
						archived ? "bg-muted text-muted-foreground" : "bg-primary/12 text-primary",
					)}
				>
					{initials(`${patient.firstName} ${patient.lastName}`)}
				</span>
				<div className="grid min-w-0 gap-1">
					<SheetTitle className="flex flex-wrap items-center gap-2 text-xl leading-tight font-semibold">
						<span className="truncate">{fullName(patient)}</span>
						<NoShowBadge count={patient.noShows} />
						{archived && <Badge variant="secondary">{t("archived")}</Badge>}
					</SheetTitle>
					<SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span className="font-mono text-xs tabular-nums">{formatFileNumber(patient.fileNumber)}</span>
						<span aria-hidden>·</span>
						<span>
							{common(`sex.${patient.sex}`)}
							{age !== null && `, ${common("age", { age })}`}
						</span>
						{patient.coverage !== "none" && (
							<>
								<span aria-hidden>·</span>
								<span>{common(`coverage.${patient.coverage}`)}</span>
							</>
						)}
					</SheetDescription>
				</div>
			</div>

			{(patient.phone || patient.email) && (
				<div className="flex flex-wrap gap-2">
					{patient.phone && (
						<a
							href={`tel:${patient.phone}`}
							className="hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm tabular-nums transition-colors"
						>
							<LuPhone className="text-muted-foreground size-3.5" />
							{formatPhone(patient.phone)}
						</a>
					)}
					{patient.email && (
						<a
							href={`mailto:${patient.email}`}
							className="hover:bg-muted inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors"
						>
							<LuMail className="text-muted-foreground size-3.5 shrink-0" />
							<span className="truncate">{patient.email}</span>
						</a>
					)}
				</div>
			)}

			<div className="flex items-center gap-2">
				{archived ? (
					<Button variant="outline" size="sm" onClick={onArchive}>
						<LuArchiveRestore /> {t("restore")}
					</Button>
				) : (
					<>
						<Button asChild size="sm">
							<Link href={`/appointments?book=${patient.id}`}>
								<LuCalendarPlus /> {t("book")}
							</Link>
						</Button>
						{medical && (
							<Button asChild variant="outline" size="sm">
								<Link href={dossierHref(patient.id)}>
									<LuStethoscope /> {t("dossier")}
								</Link>
							</Button>
						)}
						<Button variant="outline" size="sm" onClick={onEdit}>
							<LuPencil /> {t("edit")}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm" aria-label={t("moreActions")} className="ms-auto">
									<LuEllipsis />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44">
								<DropdownMenuItem onSelect={onArchive}>
									<LuArchive /> {t("archive")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}
			</div>
		</div>
	);
}

/** One block of the overview; empty ones invite to complete the file. */
function InfoCard({
	icon: Icon,
	title,
	rows,
	onComplete,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	rows: [string, React.ReactNode][];
	onComplete?: () => void;
}) {
	const filled = rows.filter(([, v]) => v);
	const t = useTranslations("patients.details");
	return (
		<section className="rounded-xl border p-4">
			<h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium">
				<Icon className="size-3.5" />
				{title}
			</h3>
			{filled.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("notProvided")}
					{onComplete && (
						<>
							{" · "}
							<button type="button" onClick={onComplete} className="text-primary font-medium hover:underline">
								{t("complete")}
							</button>
						</>
					)}
				</p>
			) : (
				<dl className="grid gap-2.5">
					{filled.map(([label, value]) => (
						<div key={label} className="grid min-w-0 gap-0.5">
							<dt className="text-muted-foreground text-xs">{label}</dt>
							<dd className="truncate text-sm">{value}</dd>
						</div>
					))}
				</dl>
			)}
		</section>
	);
}

function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
	const format = useFormat();
	return (
		<span
			className={cn(
				"flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none",
				muted ? "bg-muted/50 text-muted-foreground" : "bg-background",
			)}
		>
			<span className="text-[10px] uppercase">{format.date(iso, { month: "short", day: undefined, year: undefined }).replace(".", "")}</span>
			<span className="text-base font-semibold tabular-nums">{format.date(iso, { day: "numeric", month: undefined, year: undefined })}</span>
		</span>
	);
}

function AppointmentRow({ a, muted }: { a: Appointment; muted?: boolean }) {
	const t = useTranslations("patients.details");
	const format = useFormat();
	return (
		<li className="flex items-center gap-3 py-2.5">
			<DateTile iso={a.startsAt} muted={muted} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium first-letter:uppercase">
					{dayLabel(format, a.startsAt)} · {format.clock(a.startsAt)}
				</p>
				<p className="text-muted-foreground truncate text-xs">
					{[a.practitioner.name, a.reason, t("minutes", { count: differenceInMinutes(new Date(a.endsAt), new Date(a.startsAt)) })]
						.filter(Boolean)
						.join(" · ")}
				</p>
			</div>
			<AppointmentStatusBadge status={a.status} />
		</li>
	);
}

/**
 * The patient's file in the sheet: an overview (allergies first for
 * doctors, the next visit, the administrative blocks), the appointments,
 * and the antécédents for doctors.
 */
export function PatientDetails({
	patient,
	appointments,
	medical,
	onEdit,
	onChanged,
}: {
	patient: PatientFile;
	appointments: Appointment[] | undefined;
	medical: boolean;
	onEdit: () => void;
	onChanged: () => void;
}) {
	const [archiving, setArchiving] = useState(false);
	const t = useTranslations("patients.details");
	const common = useTranslations("common");
	const format = useFormat();
	const at = now();
	const list = appointments ?? [];
	const upcoming = list
		.filter((a) => ACTIVE.has(a.status) && new Date(a.endsAt).getTime() >= at)
		.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
	const past = list.filter((a) => !upcoming.includes(a));
	const next = upcoming[0];
	const allergies = medical ? patient.medicalProfile?.allergies : null;
	const archived = patient.archivedAt !== null;
	const complete = archived ? undefined : onEdit;

	return (
		<>
			<PatientHeader patient={patient} medical={medical} onEdit={onEdit} onArchive={() => setArchiving(true)} />
			<ArchiveDialog
				open={archiving}
				onOpenChange={setArchiving}
				patientId={patient.id}
				archived={archived}
				name={fullName(patient)}
				onDone={onChanged}
			/>

			<Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
				<div className="border-b px-5 pb-3">
					<TabsList className="w-full">
						<TabsTrigger value="overview">
							{t("tabs.overview")}
						</TabsTrigger>
						<TabsTrigger value="appointments">
							{t("tabs.appointments")}
							{list.length > 0 && (
								<span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums">
									{list.length}
								</span>
							)}
						</TabsTrigger>
						<TabsTrigger value="payments">
							{t("tabs.payments")}
						</TabsTrigger>
						{medical && (
							<TabsTrigger value="medical">
								{t("tabs.medical")}
								{allergies && <span className="size-1.5 rounded-full bg-red-500" aria-label={t("knownAllergies")} />}
							</TabsTrigger>
						)}
					</TabsList>
				</div>

				<TabsContent value="overview" className="min-h-0 overflow-y-auto p-5">
					<div className="grid gap-3">
						{archived && (
							<p className="bg-muted/60 rounded-xl px-4 py-3 text-sm">
								{t("archivedOn", { date: format.date(patient.archivedAt!) })}
							</p>
						)}
						{allergies && (
							<div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
								<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
								<div className="min-w-0">
									<p className="text-sm font-semibold">{t("allergies")}</p>
									<p className="text-sm whitespace-pre-line">{allergies}</p>
								</div>
							</div>
						)}

						<PatientBalance patientId={patient.id} />

						<section className="rounded-xl border p-4">
							<h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium">
								<LuCalendarClock className="size-3.5" />
								{t("nextAppointment")}
							</h3>
							{next ? (
								<div className="flex items-center gap-3">
									<DateTile iso={next.startsAt} />
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium first-letter:uppercase">
											{t("nextAt", { day: dayLabel(format, next.startsAt), time: format.clock(next.startsAt) })}
										</p>
										<p className="text-muted-foreground truncate text-sm">
											{[next.practitioner.name, next.reason].filter(Boolean).join(" · ")}
										</p>
									</div>
									<AppointmentStatusBadge status={next.status} />
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									{t("noAppointment")}
									{!archived && (
										<>
											{" · "}
											<Link
												href={`/appointments?book=${patient.id}`}
												className="text-primary font-medium hover:underline"
											>
												{t("planOne")}
											</Link>
										</>
									)}
								</p>
							)}
						</section>

						<div className="grid gap-3 sm:grid-cols-2">
							<InfoCard
								icon={LuIdCard}
								title={t("identity")}
								onComplete={complete}
								rows={[
									[t("birthDate"), patient.birthDate && format.date(patient.birthDate)],
									[t("cin"), patient.cin && <span className="font-mono">{patient.cin}</span>],
								]}
							/>
							<InfoCard
								icon={LuMapPin}
								title={t("address")}
								onComplete={complete}
								rows={[
									[t("address"), patient.address],
									[t("city"), patient.city],
								]}
							/>
							<InfoCard
								icon={LuShieldCheck}
								title={t("coverage")}
								onComplete={complete}
								rows={[
									[t("scheme"), patient.coverage !== "none" && common(`coverage.${patient.coverage}`)],
									[t("insurer"), patient.insurer],
									[t("registration"), patient.coverageNumber],
								]}
							/>
							<InfoCard
								icon={LuContactRound}
								title={t("emergency")}
								onComplete={complete}
								rows={[
									[t("nameAndLink"), patient.emergencyContactName],
									[
										t("phone"),
										patient.emergencyContactPhone && (
											<a href={`tel:${patient.emergencyContactPhone}`} className="tabular-nums hover:underline">
												{formatPhone(patient.emergencyContactPhone)}
											</a>
										),
									],
								]}
							/>
						</div>

						{patient.notes && (
							<section className="rounded-xl border p-4">
								<h3 className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
									<LuStickyNote className="size-3.5" />
									{t("note")}
								</h3>
								<p className="text-sm whitespace-pre-line">{patient.notes}</p>
							</section>
						)}

						<p className="text-muted-foreground pt-1 text-xs">
							{t("createdOn", { date: format.date(patient.createdAt) })}
							{patient.updatedAt !== patient.createdAt && ` · ${t("updatedOn", { date: format.date(patient.updatedAt) })}`}
						</p>
					</div>
				</TabsContent>

				<TabsContent value="appointments" className="min-h-0 overflow-y-auto p-5">
					{list.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-12 text-center">
							<LuCalendarClock className="text-muted-foreground size-6" />
							<p className="text-muted-foreground text-sm">{t("noAppointments")}</p>
							{!archived && (
								<Button asChild size="sm" variant="outline">
									<Link href={`/appointments?book=${patient.id}`}>
										<LuCalendarPlus /> {t("book")}
									</Link>
								</Button>
							)}
						</div>
					) : (
						<div className="grid gap-5">
							{upcoming.length > 0 && (
								<section>
									<h3 className="text-muted-foreground mb-1 text-xs font-medium">{t("upcoming", { count: upcoming.length })}</h3>
									<ul className="divide-y">
										{upcoming.map((a) => (
											<AppointmentRow key={a.id} a={a} />
										))}
									</ul>
								</section>
							)}
							{past.length > 0 && (
								<section>
									<h3 className="text-muted-foreground mb-1 text-xs font-medium">{t("history", { count: past.length })}</h3>
									<ul className="divide-y">
										{past.map((a) => (
											<AppointmentRow key={a.id} a={a} muted />
										))}
									</ul>
								</section>
							)}
						</div>
					)}
				</TabsContent>

				<TabsContent value="payments" className="min-h-0 overflow-y-auto p-5">
					<PatientPayments patientId={patient.id} />
				</TabsContent>

				{medical && (
					<TabsContent value="medical" className="min-h-0 overflow-y-auto p-5">
						<MedicalProfile
							patientId={patient.id}
							profile={patient.medicalProfile ?? null}
							readOnly={archived}
							sex={patient.sex}
							onSaved={onChanged}
						/>
					</TabsContent>
				)}
			</Tabs>
		</>
	);
}

