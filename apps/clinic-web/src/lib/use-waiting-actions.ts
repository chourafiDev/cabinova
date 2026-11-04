"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "./api-client";
import { type Appointment, APPOINTMENTS_KEY, patchAppointment } from "./appointments";
import { dossierHref, fullName } from "./patients";

type Visit = Pick<Appointment, "id"> & { patient: Pick<Appointment["patient"], "id" | "firstName" | "lastName"> };

/**
 * The waiting room's moves, the same everywhere (table, agenda panel, walk-in
 * sheet): shown at once, undone if the server refuses.
 * - open the file / finish: the doctor's steps (opening a waiting patient's file calls them in);
 * - left: the patient went away unseen (the visit is cancelled), with "Annuler" in the toast;
 * - back: they came back that day, behind those already waiting.
 */
export function useWaitingActions() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const t = useTranslations("agenda.waiting");
	const panel = useTranslations("agenda.panel");
	const statusLabel = useTranslations("common.appointmentStatus");

	async function run(id: string, patch: Partial<Appointment>, request: () => Promise<unknown>, success: string) {
		setBusy(id);
		const undo = patchAppointment(queryClient, id, patch);
		try {
			await request();
			return success;
		} catch (err) {
			undo();
			toast.error(err instanceof Error ? err.message : panel("statusError"));
			return null;
		} finally {
			setBusy(null);
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
		}
	}

	const setStatus = async (a: Visit, status: "in_consultation" | "completed") =>
		run(
			a.id,
			{ status },
			() => api(`/appointments/${a.id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
			panel("statusChanged", { status: statusLabel(status).toLowerCase() }),
		);

	/** The doctor takes a waiting patient: in consultation, and straight to their dossier. */
	const openFile = async (a: Visit) => {
		if (await setStatus(a, "in_consultation")) router.push(dossierHref(a.patient.id, a.id));
	};

	const finish = async (a: Visit) => {
		const done = await setStatus(a, "completed");
		if (done) toast.success(done);
	};

	const back = async (a: Visit) => {
		const now = new Date().toISOString();
		const done = await run(
			a.id,
			{ status: "arrived", arrivedAt: now, leftAt: null },
			() => api(`/appointments/${a.id}/return`, { method: "POST" }),
			t("backToast", { patient: fullName(a.patient) }),
		);
		if (done) toast.success(done);
		return !!done;
	};

	const left = async (a: Visit) => {
		const done = await run(
			a.id,
			{ status: "cancelled", leftAt: new Date().toISOString() },
			() => api(`/appointments/${a.id}/left`, { method: "POST" }),
			t("leftToast", { patient: fullName(a.patient) }),
		);
		// A slip of the finger is one click away from undone.
		if (done) toast.success(done, { duration: 10_000, action: { label: t("undo"), onClick: () => void back(a) } });
	};

	return {
		busy,
		openFile,
		finish,
		left,
		back,
	};
}
