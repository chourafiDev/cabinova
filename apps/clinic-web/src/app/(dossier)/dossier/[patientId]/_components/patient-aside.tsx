"use client";

import { useQueryClient } from "@tanstack/react-query";
import { intervalToDuration, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { MedicalProfile } from "@/app/(clinic)/patients/_components/medical-profile-card";
import {
	type AppIcon,
	IconCalendar,
	IconCall,
	IconChevronRight,
	IconContact,
	IconHeartPulse, IconIdCard,
	IconLocation,
	IconMail,
	IconShieldCheck
} from "@/components/icons";
import { initials } from "@/lib/format";
import { formatFileNumber, formatPhone, fullName, type PatientFile } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** The antécédents and current treatments, editable by the doctor. */
export function MedicalCard({ patient }: { patient: PatientFile }) {
	const t = useTranslations("dossier");
	const queryClient = useQueryClient();
	return (
		<Card icon={IconHeartPulse} title={t("aside.medical")}>
			<MedicalProfile
				patientId={patient.id}
				profile={patient.medicalProfile ?? null}
				readOnly={false}
				sex={patient.sex}
				onSaved={() => void queryClient.invalidateQueries({ queryKey: ["patient", patient.id] })}
			/>
		</Card>
	);
}

/** Left column: who the patient is and how to reach them; only what the file holds. */
export function PatientAside({ patient }: { patient: PatientFile }) {
	const t = useTranslations("dossier.aside");
	// The administrative file opens over the dossier (the patients page's sheet), never away from it.
	const [, openFile] = useQueryState("patient", parseAsString.withOptions({ history: "push", scroll: false }));
	const common = useTranslations("common");
	const format = useFormat();
	const age = exactAge(patient.birthDate);
	const coverage = patient.coverage !== "none" || patient.insurer;

	const details: { label: string; icon: AppIcon; value: React.ReactNode; full?: string }[] = [
		patient.birthDate && {
			label: t("birthDate"),
			icon: IconCalendar,
			value: (
				<span className="tabular-nums">
					{format.date(`${patient.birthDate}T12:00:00`, { day: "numeric", month: "long", year: "numeric" })}
				</span>
			),
		},
		coverage && {
			label: t("coverage"),
			icon: IconShieldCheck,
			value: [patient.coverage !== "none" && common(`coverage.${patient.coverage}`), patient.insurer]
				.filter(Boolean)
				.join(" · "),
		},
		patient.phone && {
			label: t("phone"),
			icon: IconCall,
			value: (
				<a href={`tel:${patient.phone}`} className="tabular-nums hover:underline">
					{formatPhone(patient.phone)}
				</a>
			),
		},
		patient.cin && { label: t("cin"), icon: IconIdCard, value: <span className="font-mono">{patient.cin}</span> },
		patient.email && {
			label: t("email"),
			icon: IconMail,
			value: (
				<a href={`mailto:${patient.email}`} className="hover:underline">
					{patient.email}
				</a>
			),
		},
		patient.address && {
			label: t("address"),
			icon: IconLocation,
			value: patient.address,
			full: patient.address,
		},
		patient.emergencyContactName && {
			label: t("emergency"),
			icon: IconContact,
			value: (
				<>
					{patient.emergencyContactName}
					{patient.emergencyContactPhone && (
						<a href={`tel:${patient.emergencyContactPhone}`} className="text-muted-foreground tabular-nums hover:underline">
							{" · "}
							{formatPhone(patient.emergencyContactPhone)}
						</a>
					)}
				</>
			),
		},
	].filter((d) => !!d);
	// One card that fits the column without scrolling: who, then one line per detail.
	return (
		<section className="grid grid-cols-1 gap-2" aria-label={t("contact")}>
			<SectionHeading
				title={t("contact")}
				action={
					<button
						type="button"
						onClick={() => void openFile(patient.id)}
						className="text-primary flex items-center gap-0.5 text-xs font-medium hover:underline"
					>
						{t("adminFile")} <IconChevronRight className="size-3.5 rtl:-scale-x-100" />
					</button>
				}
			/>
			<div className="bg-card overflow-hidden rounded-xl border">
				<div className="bg-brand flex items-center gap-3 px-3 py-2.5">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/12 text-sm font-semibold text-white">
						{initials(`${patient.firstName} ${patient.lastName}`)}
					</span>
					<div className="min-w-0">
						<p className="truncate font-semibold text-white">
							<span className="font-normal text-white/60">{t(`civility.${patient.sex}`)} </span>
							{fullName(patient)}
						</p>
						<p className="truncate text-xs text-white/70 tabular-nums">
							{formatFileNumber(patient.fileNumber)}
							{age && ` · ${t("exactAge", { years: age.years, months: age.months, days: age.days })}`}
						</p>
					</div>
				</div>
				{details.length > 0 && (
					<dl className="divide-y">
						{details.map((d) => (
							<div key={d.label} className="flex min-w-0 items-center gap-2.5 px-3 py-1.5 text-sm">
								<d.icon className="text-muted-foreground size-3.5 shrink-0" />
								<dt className="text-muted-foreground w-20 shrink-0 truncate text-xs" title={d.label}>
									{d.label}
								</dt>
								<dd className="min-w-0 flex-1 truncate font-medium" title={d.full}>
									{d.value}
								</dd>
							</div>
						))}
					</dl>
				)}
			</div>
		</section>
	);
}

/** A title above its cards, with a link at the end ("Historique ›"). */
export function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
	return (
		<header className="flex items-center justify-between gap-2">
			<h2 className="text-base font-semibold">{title}</h2>
			{action}
		</header>
	);
}

/** Small capitals over a value, as on the KPI cards. */
export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
	return (
		<p className={cn("text-muted-foreground text-[11px] font-medium tracking-wide uppercase", className)}>{children}</p>
	);
}

/** A small card: a round icon and its label in capitals, then the content. */
export function SmallCard({
	icon: Icon,
	label,
	wide,
	title,
	onBrand,
	className,
	children,
}: {
	icon: AppIcon;
	label: string;
	/** The full name, when the label is short. */
	title?: string;
	wide?: boolean;
	/** On the plum, like the patient's card above it: white text and icon. */
	onBrand?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"grid min-w-0 content-start gap-2 rounded-xl border p-3",
				onBrand ? "bg-brand border-transparent text-white" : "bg-card",
				wide && "col-span-2",
				className,
			)}
		>
			<dt className="flex min-w-0 items-center gap-2">
				<span
					className={cn(
						"flex size-7 shrink-0 items-center justify-center rounded-full",
						onBrand ? "bg-white/15 text-white" : "bg-muted text-muted-foreground",
					)}
				>
					<Icon className="size-3.5" />
				</span>
				<Eyebrow className={cn("truncate", onBrand && "text-white/70")}>
					<span title={title ?? label}>{label}</span>
				</Eyebrow>
			</dt>
			{children}
		</div>
	);
}

/** "37 ans 5 mois 17 jours": the age as the doctor reads it, down to the day. */
function exactAge(birthDate: string | null) {
	if (!birthDate) return null;
	const { years = 0, months = 0, days = 0 } = intervalToDuration({ start: parseISO(birthDate), end: new Date() });
	return { years, months, days };
}

export function Card({
	icon: Icon,
	title,
	aside,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="bg-card grid grid-cols-1 gap-3 rounded-xl border p-4">
			<header className="flex items-center gap-2">
				<Icon className="text-muted-foreground size-4" />
				<h2 className="text-sm font-semibold">{title}</h2>
				<span className="ms-auto">{aside}</span>
			</header>
			{children}
		</section>
	);
}
