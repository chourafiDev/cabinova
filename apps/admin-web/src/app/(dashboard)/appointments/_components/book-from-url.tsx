"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";
import { api } from "@/lib/api-client";
import type { Patient } from "@/lib/patients";

/** `/appointments?book=<patientId>` (from the patient file): opens the booking dialog for that patient. */
export function BookFromUrl({ patientId, onDone }: { patientId: string; onDone: () => void }) {
	const { openCreate } = useAppointmentDialogs();
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		api<Patient>(`/patients/${patientId}`)
			.then((p) => {
				if (p.archivedAt) toast.error("Ce dossier est archivé : restaurez-le pour prendre rendez-vous.");
				else openCreate(undefined, undefined, p);
			})
			.catch(() => toast.error("Patient introuvable."))
			.finally(onDone);
	}, [patientId, openCreate, onDone]);

	return null;
}
