"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { AppointmentFormDialog } from "@/calendar/components/dialogs/appointment-form-dialog";
import type { IEvent } from "@/calendar/interfaces";
import type { PickedPatient } from "@/components/patient-picker";

type Booking = {
  event?: IEvent;
  startDate?: Date;
  startTime?: { hour: number; minute: number };
  /** Pre-selected patient (booking from the patient file). */
  patient?: PickedPatient;
};

const AppointmentDialogsContext = createContext<{
  openCreate: (startDate?: Date, startTime?: Booking["startTime"], patient?: PickedPatient) => void;
  openEdit: (event: IEvent) => void;
  /** The appointment shown in the side panel. */
  detailsId: IEvent["id"] | null;
  openDetails: (id: IEvent["id"]) => void;
  closeDetails: () => void;
} | null>(null);

/**
 * One booking/edit dialog for the whole agenda (rather than one per time
 * slot), and the appointment open in the side panel; slots, the header and
 * the appointments reach them via the context.
 */
export function AppointmentDialogsProvider({ children }: { children: React.ReactNode }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  // New key per opening: the form starts from fresh defaults.
  const [key, setKey] = useState(0);
  const [detailsId, setDetailsId] = useState<IEvent["id"] | null>(null);
  const closeDetails = useCallback(() => setDetailsId(null), []);

  const open = (next: Booking) => {
    setKey((k) => k + 1);
    setBooking(next);
  };

  return (
    <AppointmentDialogsContext.Provider
      value={{
        openCreate: (startDate, startTime, patient) => open({ startDate, startTime, patient }),
        openEdit: (event) => open({ event }),
        detailsId,
        openDetails: setDetailsId,
        closeDetails,
      }}
    >
      {children}
      {booking && (
        <AppointmentFormDialog
          key={key}
          {...booking}
          open
          onOpenChange={(next) => !next && setBooking(null)}
        />
      )}
    </AppointmentDialogsContext.Provider>
  );
}

export function useAppointmentDialogs() {
  const context = useContext(AppointmentDialogsContext);
  if (!context) throw new Error("useAppointmentDialogs must be used within AppointmentDialogsProvider.");
  return context;
}
