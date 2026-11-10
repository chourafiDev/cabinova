"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";
import { api } from "@/lib/api-client";
import type { Patient } from "@/lib/patients";

/** `/appointments?book=<patientId>` (from the patient file): opens the booking dialog for that patient. */
export function BookFromUrl({ patientId, onDone }: { patientId: string; onDone: () => void }) {
	const { openCreate } = useAppointmentDialogs();
	const started = useRef(false);
	const t = useTranslations("agenda");

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		api<Patient>(`/patients/${patientId}`)
			.then((p) => {
				if (p.archivedAt) toast.error(t("archived"));
				else openCreate(undefined, undefined, p);
			})
			.catch(() => toast.error(t("patientNotFound")))
			.finally(onDone);
	}, [patientId, openCreate, onDone, t]);

	return null;
}
