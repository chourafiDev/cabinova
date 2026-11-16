"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { arMA, fr } from "react-day-picker/locale";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { IconSpinner } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY } from "@/lib/appointments";
import { fullName } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" → a Date at noon (no time zone shifts the day). */
const toDate = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Beside the booking form (from the dossier): a small calendar on the
 * form's date, and the practitioner's appointments that day, so the doctor
 * sees what is taken before choosing a time. Picking a day sets the date.
 */
export function DayAppointments({
	date,
	practitionerId,
	onDateChange,
}: {
	/** "YYYY-MM-DD", the form's date. */
	date: string;
	practitionerId: string;
	onDateChange: (date: string) => void;
}) {
	const t = useTranslations("agenda.form.day");
	const ar = useLocale() === "ar";
	const fmt = useFormat();
	const day = date ? toDate(date) : new Date();
	const from = new Date(`${format(day, "yyyy-MM-dd")}T00:00:00`);

	const appointments = useQuery({
		queryKey: [...APPOINTMENTS_KEY, "day", format(day, "yyyy-MM-dd"), practitionerId],
		queryFn: () =>
			api<Appointment[]>(
				`/appointments?${new URLSearchParams({
					from: from.toISOString(),
					to: addDays(from, 1).toISOString(),
					...(practitionerId && { practitionerId }),
				})}`,
			),
		enabled: !!date,
	});
	const list = (appointments.data ?? []).toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));

	return (
		<aside className="grid content-start gap-3 md:border-s md:ps-5" aria-label={t("title")}>
			<Calendar
				mode="single"
				locale={ar ? arMA : fr}
				dir={ar ? "rtl" : "ltr"}
				selected={day}
				defaultMonth={day}
				onSelect={(d) => d && onDateChange(format(d, "yyyy-MM-dd"))}
				className="mx-auto border py-4 px-8 rounded-xl"
			/>
			<div className="grid gap-2">
				<p className="flex items-center justify-between gap-2 text-sm font-medium">
					<span className="first-letter:uppercase">{fmt.date(day, { weekday: "long", day: "numeric", month: "long" })}</span>
					{appointments.isFetching ? (
						<IconSpinner className="text-muted-foreground size-3.5 animate-spin" />
					) : (
						<span className="text-muted-foreground text-xs tabular-nums">{t("count", { count: list.length })}</span>
					)}
				</p>
				{appointments.isError ? (
					<p className="text-destructive text-xs">{t("loadError")}</p>
				) : list.length === 0 && !appointments.isPending ? (
					<p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-4 text-center text-xs">{t("free")}</p>
				) : (
					<ul className="grid max-h-56 gap-1.5 overflow-y-auto pe-1">
						{list.map((a) => (
							<li
								key={a.id}
								className={cn(
									"grid gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs",
									a.status === "no_show" && "opacity-60",
								)}
							>
								<span className="flex items-center justify-between gap-2">
									<span className="font-semibold tabular-nums" dir="ltr">
										{fmt.clock(a.startsAt)} – {fmt.clock(a.endsAt)}
									</span>
									<AppointmentStatusBadge status={a.status} />
								</span>
								<span className="truncate" dir="auto">
									{fullName(a.patient)}
									{a.reason && <span className="text-muted-foreground"> · {a.reason}</span>}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
}
