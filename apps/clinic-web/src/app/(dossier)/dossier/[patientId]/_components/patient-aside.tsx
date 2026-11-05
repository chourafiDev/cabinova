"use client";

import { useQueryClient } from "@tanstack/react-query";
import { intervalToDuration, parseISO } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuContactRound, LuExternalLink, LuHeartPulse } from "react-icons/lu";
import { MedicalProfile } from "@/app/(clinic)/patients/_components/medical-profile-card";
import { formatPhone, fullName, type PatientFile, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";

/** The antécédents and current treatments, editable by the doctor. */
export function MedicalCard({ patient }: { patient: PatientFile }) {
	const t = useTranslations("dossier");
	const queryClient = useQueryClient();
	return (
		<Card icon={LuHeartPulse} title={t("aside.medical")}>
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
	const common = useTranslations("common");
	const format = useFormat();
	const age = exactAge(patient.birthDate);
	const coverage = patient.coverage !== "none" || patient.insurer;

	const rows: { label: string; value: React.ReactNode }[] = [
		patient.birthDate && {
			label: t("birthDate"),
			value: format.date(patient.birthDate, { day: "2-digit", month: "2-digit", year: "numeric" }),
		},
		coverage && {
			label: t("coverage"),
			value: (
				<>
					{[patient.coverage !== "none" && common(`coverage.${patient.coverage}`), patient.insurer]
						.filter(Boolean)
						.join(" · ")}
					{patient.coverageNumber && (
						<span className="text-muted-foreground block font-mono text-xs">{patient.coverageNumber}</span>
					)}
				</>
			),
		},
		patient.city && { label: t("city"), value: patient.city },
		patient.phone && {
			label: t("phone"),
			value: (
				<a href={`tel:${patient.phone}`} className="tabular-nums hover:underline">
					{formatPhone(patient.phone)}
				</a>
			),
		},
		patient.email && {
			label: t("email"),
			value: (
				<a href={`mailto:${patient.email}`} className="break-all hover:underline">
					{patient.email}
				</a>
			),
		},
		patient.cin && { label: t("cin"), value: <span className="font-mono">{patient.cin}</span> },
		patient.address && { label: t("address"), value: <span className="whitespace-pre-line">{patient.address}</span> },
		patient.emergencyContactName && {
			label: t("emergency"),
			value: (
				<>
					{patient.emergencyContactName}
					{patient.emergencyContactPhone && (
						<a href={`tel:${patient.emergencyContactPhone}`} className="text-muted-foreground block tabular-nums hover:underline">
							{formatPhone(patient.emergencyContactPhone)}
						</a>
					)}
				</>
			),
		},
	].filter((row) => !!row);

	return (
		<div className="grid gap-4">
			<Card
				icon={LuContactRound}
				title={t("contact")}
				aside={
					<Link
						href={patientHref(patient.id)}
						title={t("adminFile")}
						aria-label={t("adminFile")}
						className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-7 items-center justify-center rounded-md"
					>
						<LuExternalLink className="size-3.5 rtl:-scale-x-100" />
					</Link>
				}
			>
				<div className="bg-muted/50 grid gap-0.5 rounded-lg px-3 py-2.5 text-center">
					<p className="font-semibold">
						<span className="text-muted-foreground font-normal">{t(`civility.${patient.sex}`)} </span>
						{fullName(patient)}
					</p>
					{age && (
						<p className="text-primary text-sm font-medium tabular-nums">
							{t("exactAge", { years: age.years, months: age.months, days: age.days })}
						</p>
					)}
				</div>
				{rows.length > 0 && (
					<dl className="divide-y text-sm">
						{rows.map(({ label, value }) => (
							<div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2 first:pt-0 last:pb-0">
								<dt className="text-muted-foreground text-xs leading-5">{label}</dt>
								<dd className="min-w-0 leading-5">{value}</dd>
							</div>
						))}
					</dl>
				)}
			</Card>
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
		<section className="bg-card grid gap-3 rounded-xl border p-4">
			<header className="flex items-center gap-2">
				<Icon className="text-muted-foreground size-4" />
				<h2 className="text-sm font-semibold">{title}</h2>
				<span className="ms-auto">{aside}</span>
			</header>
			{children}
		</section>
	);
}
