"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY } from "@/lib/appointments";
import { fullName } from "@/lib/patients";

/**
 * Ends the visit: the notes are saved first, then the visit is completed and
 * the doctor is back in the waiting room for the next patient.
 */
export function FinishButton({
	appointment,
	beforeFinish,
}: {
	appointment: Appointment;
	beforeFinish: () => Promise<boolean>;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState(false);
	const t = useTranslations("dossier");

	if (appointment.status === "completed") return null;
	if (appointment.status !== "in_consultation" && appointment.status !== "arrived") return null;

	async function finish() {
		setBusy(true);
		try {
			if (!(await beforeFinish())) {
				toast.error(t("save.error"));
				return;
			}
			await api(`/appointments/${appointment.id}/status`, {
				method: "POST",
				body: JSON.stringify({ status: "completed" }),
			});
			toast.success(t("finished", { patient: fullName(appointment.patient) }));
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			router.push("/appointments");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("finishError"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Button onClick={finish} disabled={busy}>
			{busy ? <IconSpinner className="animate-spin" /> : <IconCheck />}
			{t("finish")}
		</Button>
	);
}
