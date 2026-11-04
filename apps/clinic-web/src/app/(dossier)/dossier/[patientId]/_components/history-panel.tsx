"use client";

import { useTranslations } from "next-intl";
import { LuChevronDown, LuHistory } from "react-icons/lu";
import { Skeleton } from "@/components/ui/skeleton";
import { bmiOf, isAbnormal, type PastConsultation, type VitalField } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { Card } from "./patient-aside";

/**
 * Right column: the patient's past consultations, newest first. Each shows
 * its diagnosis at a glance and opens to the full notes.
 */
export function HistoryPanel({
	consultations,
	loading,
}: {
	consultations: PastConsultation[] | undefined;
	loading: boolean;
}) {
	const t = useTranslations("dossier.history");
	return (
		<Card icon={LuHistory} title={t("title")} aside={consultations && consultations.length > 0 && (
			<span className="text-muted-foreground text-xs tabular-nums">{consultations.length}</span>
		)}>
			{loading ? (
				<div className="grid gap-2">
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
			) : !consultations || consultations.length === 0 ? (
				<p className="text-muted-foreground py-6 text-center text-sm">{t("empty")}</p>
			) : (
				<ol className="relative grid gap-3 before:absolute before:inset-y-2 before:start-[5px] before:w-px before:bg-border">
					{consultations.map((c, i) => (
						<Entry key={c.id} consultation={c} open={i === 0} />
					))}
				</ol>
			)}
		</Card>
	);
}

function Entry({ consultation: c, open }: { consultation: PastConsultation; open: boolean }) {
	const t = useTranslations("dossier");
	const format = useFormat();
	const bmi = bmiOf(c.weightKg, c.heightCm);
	const vitals = [
		c.systolic && c.diastolic && { key: "bp", text: `${c.systolic}/${c.diastolic}`, abnormal: isAbnormal("systolic", c.systolic) || isAbnormal("diastolic", c.diastolic) },
		...(
			[
				["heartRate", "bpm"],
				["temperature", "°C"],
				["spo2", "%"],
				["weightKg", "kg"],
				["glycemia", "g/L"],
				["glycemiaPostprandial", "g/L PP"],
				["hba1c", "% HbA1c"],
			] as [VitalField, string][]
		).map(([f, unit]) => c[f] != null && { key: f, text: `${c[f]} ${unit}`, abnormal: isAbnormal(f, c[f]) }),
		bmi && { key: "bmi", text: `IMC ${bmi}`, abnormal: false },
	].filter(Boolean) as { key: string; text: string; abnormal: boolean }[];

	return (
		<li className="relative ps-6">
			<span className="bg-primary ring-card absolute start-0 top-1.5 size-[11px] rounded-full ring-4" aria-hidden />
			<details open={open} className="group">
				<summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
					<div className="min-w-0 flex-1">
						<p className="text-muted-foreground text-xs">
							{format.date(c.date)}
							{c.act && ` · ${c.act}`}
							{c.practitioner && ` · ${c.practitioner}`}
						</p>
						<p className={cn("text-sm font-medium", !c.diagnosis && "text-muted-foreground italic")}>
							{c.diagnosis ?? t("history.noDiagnosis")}
						</p>
					</div>
					<LuChevronDown className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open:rotate-180" />
				</summary>
				<div className="mt-2 grid gap-2 text-sm">
					{vitals.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{vitals.map((v) => (
								<span
									key={v.key}
									className={cn(
										"rounded-md px-1.5 py-0.5 text-xs tabular-nums",
										v.abnormal ? "bg-amber-50 text-amber-800" : "bg-muted",
									)}
								>
									{v.text}
								</span>
							))}
						</div>
					)}
					{(["complaint", "examination", "plan"] as const).map(
						(f) =>
							c[f] && (
								<div key={f}>
									<p className="text-muted-foreground text-xs">{t(`fields.${f}`)}</p>
									<p className="whitespace-pre-line">{c[f]}</p>
								</div>
							),
					)}
				</div>
			</details>
		</li>
	);
}
