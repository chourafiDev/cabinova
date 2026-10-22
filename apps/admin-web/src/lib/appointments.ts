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

// Types and helpers of the Appointments API (apps/api/src/appointments).

export const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "arrived", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
	scheduled: "Planifié",
	confirmed: "Confirmé",
	arrived: "En salle d'attente",
	completed: "Terminé",
	no_show: "Absent",
	cancelled: "Annulé",
};

/** Event colour on the agenda = status. */
export const STATUS_COLORS: Record<AppointmentStatus, TEventColor> = {
	scheduled: "blue",
	confirmed: "purple",
	arrived: "orange",
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
	patient: { id: string; firstName: string; lastName: string; fileNumber: number; phone: string | null };
	practitioner: { id: string; name: string };
	/** Set once a consultation was started from this appointment. */
	consultationId: string | null;
};

export type Practitioner = { id: string; name: string };

/** react-query key prefix of every appointments list (invalidate after a change). */
export const APPOINTMENTS_KEY = ["appointments"] as const;

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
	consultationId: a.consultationId,
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
