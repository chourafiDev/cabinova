"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuLoader } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { DURATIONS, durationLabel } from "@/lib/appointments";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

/** Cabinet-wide: the duration pre-selected when booking (still changeable per appointment). */
export function DefaultDurationCard({ initial }: { initial: number }) {
	const router = useRouter();
	const [saved, setSaved] = useState(initial);
	const [value, setValue] = useState(initial);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		setSaving(true);
		try {
			await api("/settings/agenda", {
				method: "PUT",
				body: JSON.stringify({ defaultAppointmentMinutes: value }),
			});
			setSaved(value);
			toast.success("Durée par défaut enregistrée");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsCard
			title="Durée d’un rendez-vous"
			description="Proposée par défaut à chaque prise de rendez-vous, dans tous les espaces. Elle reste modifiable rendez-vous par rendez-vous."
			footer={
				<>
					<p className="text-muted-foreground text-xs">Les rendez-vous déjà pris ne changent pas.</p>
					<Button size="sm" disabled={value === saved || saving} onClick={save}>
						{saving && <LuLoader className="animate-spin" />} Enregistrer
					</Button>
				</>
			}
		>
			<div role="radiogroup" aria-label="Durée par défaut" className="flex flex-wrap gap-2">
				{DURATIONS.map((d) => (
					<button
						key={d}
						type="button"
						role="radio"
						aria-checked={value === d}
						onClick={() => setValue(d)}
						className={cn(
							"h-9 min-w-16 rounded-lg border px-3 text-sm transition-colors",
							value === d
								? "border-primary bg-primary text-primary-foreground font-medium"
								: "bg-background text-muted-foreground hover:text-foreground",
						)}
					>
						{durationLabel(d)}
					</button>
				))}
			</div>
		</SettingsCard>
	);
}
