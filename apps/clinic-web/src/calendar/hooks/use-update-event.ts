import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ApiError, api } from "@/lib/api-client";
import { APPOINTMENTS_KEY, patchAppointment } from "@/lib/appointments";

import type { IEvent } from "@/calendar/interfaces";

/**
 * Drag & drop: the appointment sits at its new time at once, then the time
 * is saved and the visible range reloaded. Refused, it goes back; on a slot
 * already taken, the toast offers to move it anyway.
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const t = useTranslations("agenda");

  const save = async (event: IEvent, allowOverlap: boolean): Promise<void> => {
    const undo = patchAppointment(queryClient, event.id, {
      startsAt: new Date(event.startDate).toISOString(),
      endsAt: new Date(event.endDate).toISOString(),
    });
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
      toast.success(t("moved"));
    } catch (err) {
      undo();
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        toast.error(err.message, {
          action: { label: t("moveAnyway"), onClick: () => void save(event, true) },
        });
      } else {
        toast.error(err instanceof Error ? err.message : t("moveError"));
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
    }
  };

  return { updateEvent: (event: IEvent) => save(event, false) };
}
