"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AppointmentFormDialog } from "@/calendar/components/dialogs/appointment-form-dialog";
import { CalendarProvider } from "@/calendar/contexts/calendar-context";
import { useCurrentUser } from "@/components/current-user";
import { IconCalendarAdd } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { Practitioner } from "@/lib/appointments";
import { CLOSURES_KEY, type Closure } from "@/lib/closures";
import type { PatientFile } from "@/lib/patients";
import type { OpeningHours } from "@/lib/session";

/** What the booking form needs from the agenda, given by the dossier page. */
export type BookingSettings = {
	practitioners: Practitioner[];
	openingHours: OpeningHours;
	defaultDuration: number;
	openHolidays: string[];
};

/**
 * "Rendez-vous": the agenda's booking dialog, opened over the dossier for
 * this patient (the doctor stays on the page). The doctor is the
 * practitioner by default; opening hours, congés and holidays are checked
 * as in the agenda.
 */
export function BookAppointment({ patient, settings }: { patient: PatientFile; settings: BookingSettings }) {
	const t = useTranslations("dossier");
	const user = useCurrentUser();
	const [open, setOpen] = useState(false);
	// A new key per opening: the form starts from fresh defaults.
	const [key, setKey] = useState(0);
	const [selectedDate, setSelectedDate] = useState(() => new Date());

	// Congés et absences over the coming year, loaded when the dialog opens.
	const days = useMemo(() => {
		const today = new Date();
		return { from: format(today, "yyyy-MM-dd"), to: format(addDays(today, 365), "yyyy-MM-dd") };
	}, []);
	const { data: closures } = useQuery({
		queryKey: [...CLOSURES_KEY, days.from, days.to],
		queryFn: () => api<Closure[]>(`/closures?${new URLSearchParams(days)}`),
		enabled: open,
	});
	const users = useMemo(
		() => settings.practitioners.map((p) => ({ ...p, picturePath: null })),
		[settings.practitioners],
	);
	const doctor = users.some((u) => u.id === user.id) ? user.id : "all";

	return (
		<>
			<Button
				type="button"
				variant="default"
				size="sm"
				onClick={() => {
					setKey((k) => k + 1);
					setOpen(true);
				}}
				className="bg-highlight"
			>
				<IconCalendarAdd /> {t("book")}
			</Button>
			{open && (
				<CalendarProvider
					users={users}
					events={[]}
					view="day"
					setView={() => {}}
					selectedDate={selectedDate}
					setSelectedDate={setSelectedDate}
					selectedUserId={doctor}
					setSelectedUserId={() => {}}
					selectedStatuses={[]}
					setSelectedStatuses={() => {}}
					canWrite
					openingHours={settings.openingHours}
					defaultDuration={settings.defaultDuration}
					openHolidays={settings.openHolidays}
					closures={closures}
				>
					<AppointmentFormDialog
						key={key}
						patient={{
							id: patient.id,
							firstName: patient.firstName,
							lastName: patient.lastName,
							fileNumber: patient.fileNumber,
							noShows: patient.noShows,
						}}
						dayView
						open
						onOpenChange={(next) => !next && setOpen(false)}
					/>
				</CalendarProvider>
			)}
		</>
	);
}
