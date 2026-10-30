"use client";

import { Slot } from "radix-ui";

import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";
import type { IEvent } from "@/calendar/interfaces";

/** Clicking an appointment opens it in the side panel, and marks it in the agenda. */
export function EventDetailsTrigger({ event, children }: { event: IEvent; children: React.ReactNode }) {
  const { detailsId, openDetails } = useAppointmentDialogs();
  return (
    <Slot.Root
      data-selected={detailsId === event.id || undefined}
      className="data-selected:ring-primary data-selected:ring-2"
      onClick={() => openDetails(event.id)}
    >
      {children}
    </Slot.Root>
  );
}
