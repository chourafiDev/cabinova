import Link from "next/link";
import { fmt } from "@/calendar/locale";
import type { ConsultationRow } from "@/lib/consultations";
import { FormCard } from "../../../_components/shared/form-card";
import { ConsultationStatusBadge } from "../../_components/consultation-status-badge";

/** The patient's other recent consultations. */
export function PreviousConsultations({ items }: { items: ConsultationRow[] }) {
	return (
		<FormCard title="Consultations précédentes">
			{items.length ? (
				<ul className="-mx-1 grid gap-0.5">
					{items.map((c) => (
						<li key={c.id}>
							<Link href={`/consultations/${c.id}`} className="hover:bg-muted grid gap-0.5 rounded-md px-1 py-1.5">
								<span className="flex items-center justify-between gap-2 text-sm font-medium">
									{fmt(new Date(c.startedAt), "d MMM yyyy")}
									<ConsultationStatusBadge status={c.status} />
								</span>
								<span className="text-muted-foreground truncate text-xs">
									{c.diagnosis || c.reason || "—"} · {c.practitioner.name}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">Première consultation.</p>
			)}
		</FormCard>
	);
}
