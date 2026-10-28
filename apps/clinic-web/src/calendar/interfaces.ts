import type { AppointmentStatus } from "@/lib/appointments";
import type { TEventColor } from "@/calendar/types";

/** A practitioner (column filter / event owner). */
export interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}

/** An appointment, in the shape the vendored big-calendar views expect. */
export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  /** Patient name */
  title: string;
  color: TEventColor;
  /** Motif */
  description: string;
  user: IUser;
  status: AppointmentStatus;
  patient: { id: string; firstName: string; lastName: string; fileNumber: number; phone: string | null };
  reason: string | null;
  notes: string | null;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
