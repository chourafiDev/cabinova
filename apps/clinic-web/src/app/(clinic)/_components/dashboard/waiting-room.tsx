import { LuArmchair, LuStethoscope } from "react-icons/lu";
import type { Appointment } from "@/lib/sample-data";
import { ChartCard } from "./chart-card";

/** Who is with the doctor now, and who is waiting (in arrival order). */
export function WaitingRoom({ appointments }: { appointments: Appointment[] }) {
	const current = appointments.find((a) => a.status === "in_consultation");
	const waiting = appointments
		.filter((a) => a.status === "arrived")
		.sort((a, b) => (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? ""));

	return (
		<ChartCard eyebrow="En direct" title="Salle d’attente">
			<div className="grid gap-3">
				<div className="rounded-lg bg-accent/60 p-3">
					<p className="mb-1 flex items-center gap-1.5 text-xs text-primary">
						<LuStethoscope className="size-3.5" /> En consultation
					</p>
					{current ? (
						<>
							<p className="text-sm font-semibold">{current.patient.name}</p>
							<p className="text-xs text-muted-foreground">
								RDV {current.time} · {current.reason}
							</p>
						</>
					) : (
						<p className="text-sm text-muted-foreground">Personne pour le moment.</p>
					)}
				</div>

				<div>
					<p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
						<LuArmchair className="size-3.5" /> {waiting.length} patient(s) en attente
					</p>
					{waiting.length === 0 ? (
						<p className="text-sm text-muted-foreground">La salle d’attente est vide.</p>
					) : (
						<ol className="grid gap-2">
							{waiting.map((a, i) => (
								<li key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
									<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
										{i + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{a.patient.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											Arrivé(e) à {a.arrivedAt} · RDV {a.time}
										</p>
									</div>
								</li>
							))}
						</ol>
					)}
				</div>
			</div>
		</ChartCard>
	);
}
