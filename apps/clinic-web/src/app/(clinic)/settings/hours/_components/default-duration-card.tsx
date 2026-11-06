"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { DURATIONS } from "@/lib/appointments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

/** Cabinet-wide: the duration pre-selected when booking (still changeable per appointment). */
export function DefaultDurationCard({ initial }: { initial: number }) {
	const router = useRouter();
	const [saved, setSaved] = useState(initial);
	const [value, setValue] = useState(initial);
	const [saving, setSaving] = useState(false);
	const t = useTranslations("settings.duration");
	const common = useTranslations("settings.common");
	const format = useFormat();

	const save = async () => {
		setSaving(true);
		try {
			await api("/settings/agenda", {
				method: "PUT",
				body: JSON.stringify({ defaultAppointmentMinutes: value }),
			});
			setSaved(value);
			toast.success(t("saved"));
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : common("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsCard
			title={t("title")}
			description={t("description")}
			footer={
				<>
					<p className="text-muted-foreground text-xs">{t("hint")}</p>
					<Button size="sm" disabled={value === saved || saving} onClick={save}>
						{saving && <IconSpinner className="animate-spin" />} {common("save")}
					</Button>
				</>
			}
		>
			<div role="radiogroup" aria-label={t("label")} className="flex flex-wrap gap-2">
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
						{format.duration(d)}
					</button>
				))}
			</div>
		</SettingsCard>
	);
}
