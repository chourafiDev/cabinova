"use client";

import Link from "next/link";
import { differenceInMinutes } from "date-fns";
import { LuArchive, LuArchiveRestore, LuCalendarClock, LuCalendarPlus, LuContactRound, LuEllipsis, LuIdCard, LuMail, LuMapPin, LuPencil, LuPhone, LuShieldCheck, LuStickyNote, LuTriangleAlert } from "react-icons/lu";
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
import { clock } from "@/lib/dashboard";
import { formatDate, initials } from "@/lib/format";
import { ageOf, COVERAGE_LABELS, formatFileNumber, formatPhone, fullName, type PatientFile, SEX_LABELS } from "@/lib/patients";
import { cn } from "@/lib/utils";
import { ArchiveDialog } from "./archive-button";
import { PatientBalance, PatientPayments } from "./patient-payments";
import { MedicalProfile } from "./medical-profile-card";

/** Upcoming vs past appointments (outside render: React Compiler purity). */
const now = () => Date.now();
const ACTIVE = new Set(["scheduled", "confirmed", "arrived", "in_consultation"]);

const dayLabel = (iso: string) =>
	formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: undefined });
const monthShort = (iso: string) => formatDate(iso, { month: "short", day: undefined, year: undefined }).replace(".", "");
const dayNumber = (iso: string) => formatDate(iso, { day: "numeric", month: undefined, year: undefined });

/** Header of the file: identity at a glance, one-click contact, main actions. */
export function PatientHeader({
	patient,
	onEdit,
	onArchive,
}: {
	patient: PatientFile;
	onEdit: () => void;
	onArchive: () => void;
}) {
	const age = ageOf(patient.birthDate);
	const archived = patient.archivedAt !== null;

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
						{archived && <Badge variant="secondary">Archivé</Badge>}
					</SheetTitle>
					<SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span className="font-mono text-xs tabular-nums">{formatFileNumber(patient.fileNumber)}</span>
						<span aria-hidden>·</span>
						<span>
							{SEX_LABELS[patient.sex]}
							{age !== null && `, ${age} ans`}
						</span>
						{patient.coverage !== "none" && (
							<>
								<span aria-hidden>·</span>
								<span>{COVERAGE_LABELS[patient.coverage]}</span>
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
						<LuArchiveRestore /> Restaurer le dossier
					</Button>
				) : (
					<>
						<Button asChild size="sm">
							<Link href={`/appointments?book=${patient.id}`}>
								<LuCalendarPlus /> Prendre rendez-vous
							</Link>
						</Button>
						<Button variant="outline" size="sm" onClick={onEdit}>
							<LuPencil /> Modifier
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm" aria-label="Plus d’actions" className="ms-auto">
									<LuEllipsis />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44">
								<DropdownMenuItem onSelect={onArchive}>
									<LuArchive /> Archiver le dossier
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
	return (
		<section className="rounded-xl border p-4">
			<h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium">
				<Icon className="size-3.5" />
				{title}
			</h3>
			{filled.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Non renseigné
					{onComplete && (
						<>
							{" · "}
							<button type="button" onClick={onComplete} className="text-primary font-medium hover:underline">
								Compléter
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
	return (
		<span
			className={cn(
				"flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none",
				muted ? "bg-muted/50 text-muted-foreground" : "bg-background",
			)}
		>
			<span className="text-[10px] uppercase">{monthShort(iso)}</span>
			<span className="text-base font-semibold tabular-nums">{dayNumber(iso)}</span>
		</span>
	);
}

function AppointmentRow({ a, muted }: { a: Appointment; muted?: boolean }) {
	return (
		<li className="flex items-center gap-3 py-2.5">
			<DateTile iso={a.startsAt} muted={muted} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium first-letter:uppercase">
					{dayLabel(a.startsAt)} · {clock(a.startsAt)}
				</p>
				<p className="text-muted-foreground truncate text-xs">
					{[a.practitioner.name, a.reason, `${differenceInMinutes(new Date(a.endsAt), new Date(a.startsAt))} min`]
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
			<PatientHeader patient={patient} onEdit={onEdit} onArchive={() => setArchiving(true)} />
			<ArchiveDialog
				open={archiving}
				onOpenChange={setArchiving}
				patientId={patient.id}
				archived={archived}
				name={fullName(patient)}
				onDone={onChanged}
			/>

			<Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
				<TabsList variant="line" className="w-full justify-start gap-4 border-b px-5">
					<TabsTrigger value="overview" className="flex-none px-0">
						Aperçu
					</TabsTrigger>
					<TabsTrigger value="appointments" className="flex-none px-0">
						Rendez-vous
						{list.length > 0 && (
							<span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums">
								{list.length}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger value="payments" className="flex-none px-0">
						Paiements
					</TabsTrigger>
					{medical && (
						<TabsTrigger value="medical" className="flex-none px-0">
							Antécédents
							{allergies && <span className="size-1.5 rounded-full bg-red-500" aria-label="allergies connues" />}
						</TabsTrigger>
					)}
				</TabsList>

				<TabsContent value="overview" className="min-h-0 overflow-y-auto p-5">
					<div className="grid gap-3">
						{archived && (
							<p className="bg-muted/60 rounded-xl px-4 py-3 text-sm">
								Dossier archivé le {formatDate(patient.archivedAt!)} : consultable, mais plus modifiable. Restaurez-le pour
								le modifier ou prendre rendez-vous.
							</p>
						)}
						{allergies && (
							<div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
								<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
								<div className="min-w-0">
									<p className="text-sm font-semibold">Allergies</p>
									<p className="text-sm whitespace-pre-line">{allergies}</p>
								</div>
							</div>
						)}

						<PatientBalance patientId={patient.id} />

						<section className="rounded-xl border p-4">
							<h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium">
								<LuCalendarClock className="size-3.5" />
								Prochain rendez-vous
							</h3>
							{next ? (
								<div className="flex items-center gap-3">
									<DateTile iso={next.startsAt} />
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium first-letter:uppercase">
											{dayLabel(next.startsAt)} à {clock(next.startsAt)}
										</p>
										<p className="text-muted-foreground truncate text-sm">
											{[next.practitioner.name, next.reason].filter(Boolean).join(" · ")}
										</p>
									</div>
									<AppointmentStatusBadge status={next.status} />
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Aucun rendez-vous prévu
									{!archived && (
										<>
											{" · "}
											<Link
												href={`/appointments?book=${patient.id}`}
												className="text-primary font-medium hover:underline"
											>
												En planifier un
											</Link>
										</>
									)}
								</p>
							)}
						</section>

						<div className="grid gap-3 sm:grid-cols-2">
							<InfoCard
								icon={LuIdCard}
								title="Identité"
								onComplete={complete}
								rows={[
									["Date de naissance", patient.birthDate && formatDate(patient.birthDate)],
									["CIN", patient.cin && <span className="font-mono">{patient.cin}</span>],
								]}
							/>
							<InfoCard
								icon={LuMapPin}
								title="Adresse"
								onComplete={complete}
								rows={[
									["Adresse", patient.address],
									["Ville", patient.city],
								]}
							/>
							<InfoCard
								icon={LuShieldCheck}
								title="Couverture"
								onComplete={complete}
								rows={[
									["Régime", patient.coverage !== "none" && COVERAGE_LABELS[patient.coverage]],
									["Assureur", patient.insurer],
									["N° d’immatriculation", patient.coverageNumber],
								]}
							/>
							<InfoCard
								icon={LuContactRound}
								title="Contact d’urgence"
								onComplete={complete}
								rows={[
									["Nom et lien", patient.emergencyContactName],
									[
										"Téléphone",
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
									Note administrative
								</h3>
								<p className="text-sm whitespace-pre-line">{patient.notes}</p>
							</section>
						)}

						<p className="text-muted-foreground pt-1 text-xs">
							Dossier créé le {formatDate(patient.createdAt)}
							{patient.updatedAt !== patient.createdAt && ` · modifié le ${formatDate(patient.updatedAt)}`}
						</p>
					</div>
				</TabsContent>

				<TabsContent value="appointments" className="min-h-0 overflow-y-auto p-5">
					{list.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-12 text-center">
							<LuCalendarClock className="text-muted-foreground size-6" />
							<p className="text-muted-foreground text-sm">Aucun rendez-vous pour ce patient.</p>
							{!archived && (
								<Button asChild size="sm" variant="outline">
									<Link href={`/appointments?book=${patient.id}`}>
										<LuCalendarPlus /> Prendre rendez-vous
									</Link>
								</Button>
							)}
						</div>
					) : (
						<div className="grid gap-5">
							{upcoming.length > 0 && (
								<section>
									<h3 className="text-muted-foreground mb-1 text-xs font-medium">À venir · {upcoming.length}</h3>
									<ul className="divide-y">
										{upcoming.map((a) => (
											<AppointmentRow key={a.id} a={a} />
										))}
									</ul>
								</section>
							)}
							{past.length > 0 && (
								<section>
									<h3 className="text-muted-foreground mb-1 text-xs font-medium">Historique · {past.length}</h3>
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
							onSaved={onChanged}
						/>
					</TabsContent>
				)}
			</Tabs>
		</>
	);
}

