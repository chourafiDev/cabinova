import { useTranslations } from "next-intl";
import { LuArmchair, LuStethoscope } from "react-icons/lu";
import type { DashboardData } from "@/lib/dashboard";
import { fullName } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { ChartCard } from "./chart-card";

/** Who is with the doctor now, and who is waiting (in arrival order). */
export function WaitingRoom({ appointments }: { appointments: NonNullable<DashboardData["appointments"]> }) {
	const current = appointments.filter((a) => a.status === "in_consultation");
	const waiting = appointments
		.filter((a) => a.status === "arrived")
		.sort((a, b) => (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? ""));
	const t = useTranslations("dashboard.waitingRoom");
	const format = useFormat();

	return (
		<ChartCard eyebrow={t("eyebrow")} title={t("title")}>
			<div className="grid gap-3">
				<div className="rounded-lg bg-accent/60 p-3">
					<p className="mb-1 flex items-center gap-1.5 text-xs text-primary">
						<LuStethoscope className="size-3.5" /> {t("current")}
					</p>
					{current.length > 0 ? (
						current.map((a) => (
							<div key={a.id}>
								<p className="text-sm font-semibold">{fullName(a.patient)}</p>
								<p className="text-xs text-muted-foreground">
									{t("appointmentAt", { time: format.clock(a.startsAt) })} · {a.practitioner.name}
								</p>
							</div>
						))
					) : (
						<p className="text-sm text-muted-foreground">{t("nobody")}</p>
					)}
				</div>

				<div>
					<p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
						<LuArmchair className="size-3.5" /> {t("waiting", { count: waiting.length })}
					</p>
					{waiting.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("empty")}</p>
					) : (
						<ol className="grid gap-2">
							{waiting.map((a, i) => (
								<li key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
									<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
										{i + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{fullName(a.patient)}</p>
										<p className="truncate text-xs text-muted-foreground">
											{t("arrivedAt", { time: a.arrivedAt ? format.clock(a.arrivedAt) : "—" })} ·{" "}
											{t("appointmentAt", { time: format.clock(a.startsAt) })}
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
