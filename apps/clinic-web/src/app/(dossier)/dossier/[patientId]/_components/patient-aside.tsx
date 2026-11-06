"use client";

import { useQueryClient } from "@tanstack/react-query";
import { intervalToDuration, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { MedicalProfile } from "@/app/(clinic)/patients/_components/medical-profile-card";
import {
	type AppIcon,
	IconCall,
	IconChevronRight,
	IconContact,
	IconHeartPulse,
	IconHome,
	IconIdCard,
	IconMail,
	IconShieldCheck,
} from "@/components/icons";
import { initials } from "@/lib/format";
import { formatFileNumber, formatPhone, fullName, type PatientFile } from "@/lib/patients";
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
	const age = exactAge(patient.birthDate);
	const coverage = patient.coverage !== "none" || patient.insurer;

	const details: { label: string; icon: AppIcon; value: React.ReactNode; wide?: boolean }[] = [
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
				<a href={`mailto:${patient.email}`} className="break-all hover:underline">
					{patient.email}
				</a>
			),
		},
		patient.address && { label: t("address"), icon: IconHome, wide: true, value: patient.address },
		patient.emergencyContactName && {
			label: t("emergency"),
			icon: IconContact,
			wide: true,
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
	// An odd last half-width card spans the row rather than leaving a hole.
	const halves = details.filter((d) => !d.wide);
	const lastHalf = halves.length % 2 === 1 ? halves.at(-1) : undefined;

	return (
		<section className="grid grid-cols-1 gap-3" aria-label={t("contact")}>
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
			<div className="bg-card flex items-center gap-3 rounded-xl border p-3">
				<span className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
					{initials(`${patient.firstName} ${patient.lastName}`)}
				</span>
				<div className="min-w-0">
					<Eyebrow>
						{common(`sex.${patient.sex}`)} · {formatFileNumber(patient.fileNumber)}
					</Eyebrow>
					<p className="truncate font-semibold">
						<span className="text-muted-foreground font-normal">{t(`civility.${patient.sex}`)} </span>
						{fullName(patient)}
					</p>
					{age && (
						<p className="text-primary text-sm tabular-nums">
							{t("exactAge", { years: age.years, months: age.months, days: age.days })}
						</p>
					)}
				</div>
			</div>
			{details.length > 0 && (
				<dl className="grid grid-cols-2 gap-2">
					{details.map((d) => (
						<SmallCard key={d.label} icon={d.icon} label={d.label} wide={d.wide || d === lastHalf}>
							<dd className="text-sm font-medium break-words">{d.value}</dd>
						</SmallCard>
					))}
				</dl>
			)}
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
	className,
	children,
}: {
	icon: AppIcon;
	label: string;
	/** The full name, when the label is short. */
	title?: string;
	wide?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("bg-card grid min-w-0 content-start gap-2 rounded-xl border p-3", wide && "col-span-2", className)}>
			<dt className="flex min-w-0 items-center gap-2">
				<span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
					<Icon className="size-3.5" />
				</span>
				<Eyebrow className="truncate">
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
