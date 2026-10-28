"use client";

import { Slot } from "radix-ui";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";

/** Clicking an empty slot books an appointment there (read-only users: nothing). */
export function AddEventDialog({
  children,
  startDate,
  startTime,
}: {
  children: React.ReactNode;
  startDate?: Date;
  startTime?: { hour: number; minute: number };
}) {
  const { canWrite } = useCalendar();
  const { openCreate } = useAppointmentDialogs();
  if (!canWrite) return <>{children}</>;
  return <Slot.Root onClick={() => openCreate(startDate, startTime)}>{children}</Slot.Root>;
}
