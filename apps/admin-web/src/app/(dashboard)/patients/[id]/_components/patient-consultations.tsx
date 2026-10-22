import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { fmt } from "@/calendar/locale";
import { MedicalProfileCard } from "@/components/medical-profile-card";
import { StartConsultationButton } from "@/components/start-consultation-button";
import type { ConsultationRow, MedicalProfile } from "@/lib/consultations";
import { FormCard } from "../../../_components/shared/form-card";
import { ConsultationStatusBadge } from "../../../consultations/_components/consultation-status-badge";

/** Consultations of the patient (latest first) + antécédents. */
export function PatientConsultations({
	patientId,
	consultations,
	profile,
	canWrite,
	canStart,
}: {
	patientId: string;
	consultations: ConsultationRow[];
	profile: MedicalProfile;
	/** emr:write */
	canWrite: boolean;
	/** emr:write and the file is not archived */
	canStart: boolean;
}) {
	return (
		<div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
			<FormCard
				title={`Consultations (${consultations.length})`}
				action={canStart && <StartConsultationButton patientId={patientId} size="sm" />}
			>
				{consultations.length ? (
					<ul className="divide-y rounded-lg border">
						{consultations.map((c) => (
							<li key={c.id}>
								<Link
									href={`/consultations/${c.id}`}
									className="hover:bg-muted/60 flex items-center gap-3 px-3 py-2.5 transition-colors"
								>
									<div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
										<span className="text-sm font-medium">
											{fmt(new Date(c.startedAt), "d MMMM yyyy")}
											<span className="text-muted-foreground font-normal"> · {c.practitioner.name}</span>
										</span>
										<span className="text-muted-foreground truncate text-xs">
											{[c.reason, c.diagnosis].filter(Boolean).join(" · ") || "—"}
										</span>
									</div>
									<ConsultationStatusBadge status={c.status} />
									<ChevronRight className="text-muted-foreground size-4 shrink-0" />
								</Link>
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground py-2 text-sm">Aucune consultation.</p>
				)}
			</FormCard>
			<MedicalProfileCard patientId={patientId} profile={profile} canWrite={canWrite} />
		</div>
	);
}
