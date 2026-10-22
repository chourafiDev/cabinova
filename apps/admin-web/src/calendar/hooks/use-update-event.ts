import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { APPOINTMENTS_KEY } from "@/lib/appointments";

import type { IEvent } from "@/calendar/interfaces";

/** Drag & drop: saves the new time, then reloads the visible range. */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  const updateEvent = async (event: IEvent) => {
    try {
      await api(`/appointments/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          patientId: event.patient.id,
          practitionerId: event.user.id,
          startsAt: new Date(event.startDate).toISOString(),
          endsAt: new Date(event.endDate).toISOString(),
          reason: event.reason,
          notes: event.notes,
        }),
      });
      toast.success("Rendez-vous déplacé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Déplacement impossible");
    } finally {
      await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
    }
  };

  return { updateEvent };
}
