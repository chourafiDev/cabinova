"use client";

import { Loader, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

/** Creates a draft (or reopens the appointment's one) and opens the editor. */
export function StartConsultationButton({
	patientId,
	appointmentId,
	label = "Nouvelle consultation",
	...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
	patientId: string;
	appointmentId?: string;
	label?: string;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function start() {
		setBusy(true);
		try {
			const { id } = await api<{ id: string }>("/consultations", {
				method: "POST",
				body: JSON.stringify({ patientId, appointmentId }),
			});
			router.push(`/consultations/${id}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Impossible de démarrer la consultation");
			setBusy(false);
		}
	}

	return (
		<Button type="button" onClick={start} disabled={busy} {...props}>
			{busy ? <Loader className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
			{label}
		</Button>
	);
}
