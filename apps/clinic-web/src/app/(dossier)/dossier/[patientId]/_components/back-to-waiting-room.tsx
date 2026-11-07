"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconArrowLeft, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Appointment } from "@/lib/appointments";
import { fullName } from "@/lib/patients";

/**
 * "Salle d'attente" during a visit: asks first, since leaving doesn't end the
 * consultation. The notes and the ordonnance are saved before going.
 */
export function BackToWaitingRoom({
	appointment,
	beforeLeave,
}: {
	appointment: Appointment | undefined;
	beforeLeave: () => Promise<boolean>;
}) {
	const router = useRouter();
	const t = useTranslations("dossier");
	const [open, setOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const unfinished = appointment?.status === "in_consultation" || appointment?.status === "arrived";

	async function leave() {
		setLeaving(true);
		try {
			if (!(await beforeLeave())) {
				toast.error(t("save.error"));
				return;
			}
			router.push("/appointments");
		} finally {
			setLeaving(false);
		}
	}

	return (
		<>
			<Button variant="ghost" size="sm" className="-ms-2" onClick={() => setOpen(true)}>
				<IconArrowLeft className="rtl:-scale-x-100" /> {t("back")}
			</Button>
			<Dialog open={open} onOpenChange={(o) => !leaving && setOpen(o)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("leave.title")}</DialogTitle>
						<DialogDescription>
							{unfinished && appointment
								? t("leave.unfinished", { patient: fullName(appointment.patient) })
								: t("leave.saved")}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)} disabled={leaving}>
							{t("leave.stay")}
						</Button>
						<Button onClick={leave} disabled={leaving} autoFocus>
							{leaving && <IconSpinner className="animate-spin" />} {t("leave.confirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
