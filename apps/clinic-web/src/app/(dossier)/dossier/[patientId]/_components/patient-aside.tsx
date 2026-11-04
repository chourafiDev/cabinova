"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuCalendarClock, LuContactRound, LuExternalLink, LuHeartPulse, LuIdCard, LuPhone, LuShieldCheck } from "react-icons/lu";
import { MedicalProfile } from "@/app/(clinic)/patients/_components/medical-profile-card";
import { PatientBalance } from "@/app/(clinic)/patients/_components/patient-payments";
import type { Appointment } from "@/lib/appointments";
import { formatPhone, type PatientFile, patientHref } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";

/** Left column: what the doctor checks before writing — antécédents, the next visit, how to reach the patient. */
export function PatientAside({ patient, next }: { patient: PatientFile; next: Appointment | undefined }) {
	const t = useTranslations("dossier");
	const common = useTranslations("common");
	const format = useFormat();
	const queryClient = useQueryClient();

	return (
		<div className="grid gap-4">
			<Card icon={LuHeartPulse} title={t("aside.medical")}>
				<MedicalProfile
					patientId={patient.id}
					profile={patient.medicalProfile ?? null}
					readOnly={false}
					sex={patient.sex}
					onSaved={() => void queryClient.invalidateQueries({ queryKey: ["patient", patient.id] })}
				/>
			</Card>

			<PatientBalance patientId={patient.id} />

			{next && (
				<Card icon={LuCalendarClock} title={t("aside.next")}>
					<p className="text-sm font-medium first-letter:uppercase">
						{format.date(next.startsAt, { weekday: "long" })} · {format.clock(next.startsAt)}
					</p>
					<p className="text-muted-foreground text-xs">
						{[next.reason, next.practitioner.name].filter(Boolean).join(" · ")}
					</p>
				</Card>
			)}

			<Card
				icon={LuContactRound}
				title={t("aside.contact")}
				aside={
					<Link
						href={patientHref(patient.id)}
						className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
					>
						{t("aside.adminFile")} <LuExternalLink className="size-3 rtl:-scale-x-100" />
					</Link>
				}
			>
				<dl className="grid gap-2.5 text-sm">
					{patient.phone && (
						<Row icon={LuPhone}>
							<a href={`tel:${patient.phone}`} className="tabular-nums hover:underline">
								{formatPhone(patient.phone)}
							</a>
						</Row>
					)}
					{patient.cin && (
						<Row icon={LuIdCard}>
							<span className="font-mono text-xs">{patient.cin}</span>
						</Row>
					)}
					<Row icon={LuShieldCheck}>
						{common(`coverage.${patient.coverage}`)}
						{patient.coverageNumber && <span className="text-muted-foreground"> · {patient.coverageNumber}</span>}
					</Row>
					{patient.emergencyContactName && (
						<Row icon={LuContactRound}>
							<span>{patient.emergencyContactName}</span>
							{patient.emergencyContactPhone && (
								<span className="text-muted-foreground tabular-nums"> · {formatPhone(patient.emergencyContactPhone)}</span>
							)}
						</Row>
					)}
				</dl>
			</Card>
		</div>
	);
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

function Row({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2.5">
			<Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
			<div className="min-w-0">{children}</div>
		</div>
	);
}
