"use client";

import { useTranslations } from "next-intl";
import { LuClipboardList } from "react-icons/lu";
import { VitalsChips } from "@/components/vitals-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/lib/use-format";
import { bmiFor, type VitalSigns } from "@/lib/vitals";
import { Card } from "./patient-aside";

/** Constantes taken by the team outside the consultations (front desk), newest first. */
export function RecordedVitals({ vitals, loading }: { vitals: VitalSigns[] | undefined; loading: boolean }) {
	const t = useTranslations("dossier.recorded");
	const by = useTranslations("patients.vitals");
	const format = useFormat();
	return (
		<Card
			icon={LuClipboardList}
			title={t("title")}
			aside={vitals && vitals.length > 0 && <span className="text-muted-foreground text-xs tabular-nums">{vitals.length}</span>}
		>
			{loading ? (
				<Skeleton className="h-16" />
			) : !vitals?.length ? (
				<p className="text-muted-foreground text-xs">{t("empty")}</p>
			) : (
				<ol className="grid max-h-80 gap-3 overflow-y-auto">
					{vitals.map((v) => (
						<li key={v.id} className="grid gap-1">
							<p className="text-muted-foreground text-xs">
								{format.date(v.measuredAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
								{v.recordedBy && ` · ${by("by", { name: v.recordedBy })}`}
							</p>
							<VitalsChips vitals={v} bmi={bmiFor(v, vitals)} />
							{v.note && <p className="text-muted-foreground text-xs whitespace-pre-line">{v.note}</p>}
						</li>
					))}
				</ol>
			)}
		</Card>
	);
}
