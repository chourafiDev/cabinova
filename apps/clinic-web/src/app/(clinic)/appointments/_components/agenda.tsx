"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useTranslations } from "next-intl";
import { parseAsIsoDate, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useMemo } from "react";

import { ClientContainer } from "@/calendar/components/client-container";
import { AppointmentDialogsProvider } from "@/calendar/components/dialogs/appointment-dialogs";
import { AppointmentPanel } from "@/calendar/components/dialogs/appointment-panel";
import { CalendarProvider } from "@/calendar/contexts/calendar-context";
import type { TCalendarView } from "@/calendar/types";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY, type Practitioner, toEvent, visibleRange } from "@/lib/appointments";
import type { OpeningHours } from "@/lib/session";
import { CLOSURES_KEY, type Closure } from "@/lib/closures";
import { cn } from "@/lib/utils";
import { BookFromUrl } from "./book-from-url";

const VIEWS = ["day", "week", "month", "year", "agenda"] as const satisfies TCalendarView[];

const searchParams = {
	view: parseAsStringEnum<TCalendarView>([...VIEWS]).withDefault("week"),
	date: parseAsIsoDate,
	practitioner: parseAsString.withDefault("all"),
	/** Patient id: open the booking dialog for them (link from the patient file). */
	book: parseAsString,
};

/** Agenda page: big-calendar views on the appointments API. View, date and practitioner live in the URL. */
export function Agenda({
	practitioners,
	canWrite,
	openingHours,
	defaultDuration,
	openHolidays,
}: {
	practitioners: Practitioner[];
	canWrite: boolean;
	openingHours: OpeningHours;
	defaultDuration: number;
	/** The public holidays the cabinet works (keys). */
	openHolidays: string[];
}) {
	const [{ view, date, practitioner, book }, setParams] = useQueryStates(searchParams, { history: "replace" });
	const selectedDate = useMemo(() => date ?? new Date(), [date]);
	const t = useTranslations("agenda");
	const range = visibleRange(view, selectedDate);

	const { data, isFetching, isError } = useQuery({
		queryKey: [...APPOINTMENTS_KEY, range.from.toISOString(), range.to.toISOString()],
		queryFn: () =>
			api<Appointment[]>(
				`/appointments?${new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() })}`,
			),
		placeholderData: keepPreviousData,
	});

	// Congés et absences over the same days (the range ends the day before `to`).
	const days = { from: format(range.from, "yyyy-MM-dd"), to: format(subDays(range.to, 1), "yyyy-MM-dd") };
	const { data: closures } = useQuery({
		queryKey: [...CLOSURES_KEY, days.from, days.to],
		queryFn: () => api<Closure[]>(`/closures?${new URLSearchParams(days)}`),
		placeholderData: keepPreviousData,
	});

	const events = useMemo(() => (data ?? []).map(toEvent), [data]);
	const users = useMemo(() => practitioners.map((p) => ({ ...p, picturePath: null })), [practitioners]);

	return (
		<CalendarProvider
			users={users}
			events={events}
			view={view}
			setView={(v) => setParams({ view: v })}
			selectedDate={selectedDate}
			// "Today" clears the param: a bookmarked agenda always opens on the current day.
			setSelectedDate={(d) =>
				setParams({ date: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? null : d })
			}
			selectedUserId={practitioner}
			setSelectedUserId={(id) => setParams({ practitioner: id === "all" ? null : id })}
			canWrite={canWrite}
			openingHours={openingHours}
			defaultDuration={defaultDuration}
			openHolidays={openHolidays}
			closures={closures}
		>
			<AppointmentDialogsProvider>
				{book && canWrite && <BookFromUrl patientId={book} onDone={() => setParams({ book: null })} />}
				{isError && (
					<p className="text-destructive mb-2 text-sm">{t("loadError")}</p>
				)}
				<div className="flex items-start gap-3">
					<div className={cn("min-w-0 flex-1 transition-opacity", isFetching && "opacity-70")}>
						<ClientContainer view={view} />
					</div>
					<AppointmentPanel />
				</div>
			</AppointmentDialogsProvider>
		</CalendarProvider>
	);
}
