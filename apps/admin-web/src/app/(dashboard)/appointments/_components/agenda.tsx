"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { parseAsIsoDate, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useMemo } from "react";

import { ClientContainer } from "@/calendar/components/client-container";
import { AppointmentDialogsProvider } from "@/calendar/components/dialogs/appointment-dialogs";
import { CalendarProvider } from "@/calendar/contexts/calendar-context";
import type { TCalendarView } from "@/calendar/types";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY, type Practitioner, toEvent, visibleRange } from "@/lib/appointments";
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
export function Agenda({ practitioners, canWrite }: { practitioners: Practitioner[]; canWrite: boolean }) {
	const [{ view, date, practitioner, book }, setParams] = useQueryStates(searchParams, { history: "replace" });
	const selectedDate = useMemo(() => date ?? new Date(), [date]);
	const range = visibleRange(view, selectedDate);

	const { data, isFetching, isError } = useQuery({
		queryKey: [...APPOINTMENTS_KEY, range.from.toISOString(), range.to.toISOString()],
		queryFn: () =>
			api<Appointment[]>(
				`/appointments?${new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() })}`,
			),
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
		>
			<AppointmentDialogsProvider>
				{book && canWrite && <BookFromUrl patientId={book} onDone={() => setParams({ book: null })} />}
				{isError && (
					<p className="text-destructive mb-2 text-sm">Impossible de charger les rendez-vous. Réessayez.</p>
				)}
				<div className={cn("transition-opacity", isFetching && "opacity-70")}>
					<ClientContainer view={view} />
				</div>
			</AppointmentDialogsProvider>
		</CalendarProvider>
	);
}
