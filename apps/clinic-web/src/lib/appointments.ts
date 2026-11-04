import type { QueryClient } from "@tanstack/react-query";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { IEvent } from "@/calendar/interfaces";
import { WEEK } from "@/calendar/locale";
import type { TCalendarView, TEventColor } from "@/calendar/types";

// Types and helpers of the Appointments API (clinic-api/src/appointments).

export const APPOINTMENT_STATUSES = [
	"scheduled",
	"confirmed",
	"arrived",
	"in_consultation",
	"completed",
	"no_show",
	"cancelled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Event colour on the agenda = status. */
export const STATUS_COLORS: Record<AppointmentStatus, TEventColor> = {
	scheduled: "blue",
	confirmed: "purple",
	arrived: "orange",
	in_consultation: "yellow",
	completed: "green",
	no_show: "red",
	cancelled: "gray",
};

export type Appointment = {
	id: string;
	startsAt: string;
	endsAt: string;
	status: AppointmentStatus;
	reason: string | null;
	notes: string | null;
	/** Checked in at the front desk (waiting room order). */
	arrivedAt: string | null;
	/** Came without an appointment (booked on arrival). */
	walkIn: boolean;
	patient: {
		id: string;
		firstName: string;
		lastName: string;
		fileNumber: number;
		phone: string | null;
		birthDate: string | null;
		sex: "male" | "female";
	};
	practitioner: { id: string; name: string };
};

export type Practitioner = { id: string; name: string };

/** react-query key prefix of every appointments list (invalidate after a change). */
export const APPOINTMENTS_KEY = ["appointments"] as const;

/**
 * Shows a change on every loaded agenda before the server answers. Returns
 * the undo, for when it refuses; refetch afterwards either way.
 */
export function patchAppointment(queryClient: QueryClient, id: string, patch: Partial<Appointment>) {
	void queryClient.cancelQueries({ queryKey: APPOINTMENTS_KEY });
	const before = queryClient.getQueriesData<Appointment[]>({ queryKey: APPOINTMENTS_KEY });
	queryClient.setQueriesData<Appointment[]>({ queryKey: APPOINTMENTS_KEY }, (list) =>
		list?.map((a) => (a.id === id ? { ...a, ...patch } : a)),
	);
	return () => {
		for (const [key, list] of before) queryClient.setQueryData(key, list);
	};
}

export const toEvent = (a: Appointment): IEvent => ({
	id: a.id,
	startDate: a.startsAt,
	endDate: a.endsAt,
	title: `${a.patient.lastName.toUpperCase()} ${a.patient.firstName}`,
	color: STATUS_COLORS[a.status],
	description: a.reason ?? "",
	user: { id: a.practitioner.id, name: a.practitioner.name, picturePath: null },
	status: a.status,
	patient: a.patient,
	reason: a.reason,
	notes: a.notes,
});

/** Range to load for a view: the whole visible grid (month view shows adjacent days). */
export function visibleRange(view: TCalendarView, date: Date) {
	switch (view) {
		case "day":
			return { from: startOfDay(date), to: addDays(startOfDay(date), 1) };
		case "week":
			return { from: startOfWeek(date, WEEK), to: addDays(startOfWeek(date, WEEK), 7) };
		case "month":
		case "agenda":
			return {
				from: startOfWeek(startOfMonth(date), WEEK),
				to: addDays(endOfWeek(endOfMonth(date), WEEK), 1),
			};
		case "year":
			return { from: startOfYear(date), to: addDays(endOfYear(date), 1) };
	}
}

export const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

/** 30 → "30 min", 90 → "1 h 30". */
export function durationLabel(min: number, locale = "fr-MA") {
	const [minutes, hours] = locale.startsWith("ar") ? ["د", "س"] : ["min", "h"];
	if (min < 60) return `${min} ${minutes}`;
	const rest = min % 60;
	return `${Math.floor(min / 60)} ${hours}${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}
