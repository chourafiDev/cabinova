"use client";

import { useTranslations } from "next-intl";
import { isAbnormal } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ARMS, MEASURES, type Measure, type VitalSigns } from "@/lib/vitals";

const SHOWN: Measure[] = [
	"weightKg",
	"heightCm",
	"temperatureC",
	"glycemia",
	"glycemiaPostprandial",
	"hba1c",
	"heartRate",
	"spo2",
	"waistCm",
	"headCircumferenceCm",
	"abdominalCircumferenceCm",
];
const ABNORMAL: Partial<Record<Measure, Parameters<typeof isAbnormal>[0]>> = {
	temperatureC: "temperature",
	glycemia: "glycemia",
	glycemiaPostprandial: "glycemiaPostprandial",
	hba1c: "hba1c",
	heartRate: "heartRate",
	spo2: "spo2",
};

/** One measurement as small labelled values; unusual ones in amber. */
export function VitalsChips({ vitals: v, bmi }: { vitals: VitalSigns; bmi: number | null }) {
	const t = useTranslations("patients.vitals");
	const format = useFormat();
	const chips = [
		...ARMS.map((arm) => {
			const sys = v[`bp${arm}Systolic`];
			const dia = v[`bp${arm}Diastolic`];
			return (
				sys != null &&
				dia != null && {
					key: arm,
					text: `${t(`short.bp${arm}`)} ${sys}/${dia}`,
					abnormal: isAbnormal("systolic", sys) || isAbnormal("diastolic", dia),
				}
			);
		}),
		...SHOWN.map((m) => {
			const value = v[m];
			const rule = ABNORMAL[m];
			return (
				value != null && {
					key: m,
					text: `${t(`short.${m}`)} ${format.number(value)} ${MEASURES[m].unit}`,
					abnormal: rule ? isAbnormal(rule, value) : false,
				}
			);
		}),
		bmi != null && { key: "bmi", text: `${t("short.bmi")} ${format.number(bmi)}`, abnormal: bmi >= 30 || bmi < 18.5 },
		v.bloodGroup && { key: "blood", text: `${t("short.bloodGroup")} ${v.bloodGroup}`, abnormal: false },
	].filter(Boolean) as { key: string; text: string; abnormal: boolean }[];

	return (
		<div className="flex flex-wrap gap-1">
			{chips.map((c) => (
				<span
					key={c.key}
					dir="auto"
					className={cn("rounded-md px-1.5 py-0.5 text-xs tabular-nums", c.abnormal ? "bg-amber-50 text-amber-800" : "bg-muted")}
				>
					{c.text}
				</span>
			))}
		</div>
	);
}
