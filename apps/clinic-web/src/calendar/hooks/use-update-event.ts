import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, api } from "@/lib/api-client";
import { APPOINTMENTS_KEY } from "@/lib/appointments";

import type { IEvent } from "@/calendar/interfaces";

/**
 * Drag & drop: saves the new time, then reloads the visible range. On a
 * slot already taken, the toast offers to move it anyway.
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  const save = async (event: IEvent, allowOverlap: boolean): Promise<void> => {
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
          allowOverlap,
        }),
      });
      toast.success("Rendez-vous déplacé");
    } catch (err) {
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        toast.error(err.message, {
          action: { label: "Déplacer quand même", onClick: () => void save(event, true) },
        });
      } else {
        toast.error(err instanceof Error ? err.message : "Déplacement impossible");
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
    }
  };

  return { updateEvent: (event: IEvent) => save(event, false) };
}
