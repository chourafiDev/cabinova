"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
	type AppIcon,
	IconActivity,
	IconChevronRight,
	IconDrop,
	IconGauge,
	IconHeartPulse,
	IconLab,
	IconRuler,
	IconThermometer,
	IconWarning,
	IconWeight,
	IconWind,
} from "@/components/icons";
import { VitalsChips } from "@/components/vitals-chips";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { moroccoDay } from "@cabinova/morocco-time";
import { bmiCategory, bmiOf, type Consultation, isAbnormal, VITAL_FIELDS, type VitalField } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ARMS, bmiFor, MEASURES, type Measure, type VitalSigns } from "@/lib/vitals";
import { Eyebrow, SectionHeading, SmallCard } from "./patient-aside";
import { type Point, TrendsCard } from "./trends-card";

/** One dated measurement: taken by the team, or during a consultation. */
export type VitalsEntry = { source: "staff" | "visit"; vitals: VitalSigns };

/** A consultation's constantes in the team's shape (its pressure has no arm: shown as the right one). */
export function consultationVitals(
	c: Pick<Consultation, VitalField | "id">,
	date: string,
	by: string | null,
): VitalsEntry | null {
	if (VITAL_FIELDS.every((f) => c[f] == null)) return null;
	return {
		source: "visit",
		vitals: {
			id: c.id,
			measuredAt: date,
			recordedById: null,
			recordedBy: by,
			bloodGroup: null,
			note: null,
			weightKg: c.weightKg,
			heightCm: c.heightCm,
			temperatureC: c.temperature,
			glycemia: c.glycemia,
			glycemiaPostprandial: c.glycemiaPostprandial,
			hba1c: c.hba1c,
			bpRightSystolic: c.systolic,
			bpRightDiastolic: c.diastolic,
			bpLeftSystolic: null,
			bpLeftDiastolic: null,
			heartRate: c.heartRate,
			spo2: c.spo2,
			waistCm: null,
			headCircumferenceCm: null,
			abdominalCircumferenceCm: null,
		},
	};
}

/**
 * Left column: the latest value of each constante, wherever it was taken,
 * and the whole history (curves and every measurement) in a sheet below.
 */
export function LatestVitals({
	entries,
	points,
	loading,
}: {
	/** Newest first. */
	entries: VitalsEntry[];
	points: Point[];
	loading: boolean;
}) {
	const t = useTranslations("dossier.latest");
	const fields = useTranslations("patients.vitals.fields");
	const short = useTranslations("patients.vitals.short");
	const bmiLabel = useTranslations("patients.vitals.bmiCategory");
	const format = useFormat();
	const [open, setOpen] = useState(false);

	const latest = entries[0];
	// Each measure from the newest measurement that has it, and the one before (for the change).
	const reading = (pick: (v: VitalSigns) => number | null): Reading | null => {
		const i = entries.findIndex((e) => pick(e.vitals) != null);
		if (i < 0) return null;
		const before = entries.slice(i + 1).find((e) => pick(e.vitals) != null);
		return {
			value: pick(entries[i].vitals) as number,
			previous: before ? pick(before.vitals) : null,
			date: entries[i].vitals.measuredAt,
		};
	};
	/** Under the value: unusual, taken earlier, how it moved, or within range. */
	const status = (r: Reading, abnormal: boolean, unit = "", ruled = false) => {
		if (abnormal) return t("unusual");
		if (latest && moroccoDay(new Date(r.date)) !== moroccoDay(new Date(latest.vitals.measuredAt))) {
			return t("takenOn", { date: format.date(r.date, { day: "numeric", month: "short" }) });
		}
		const change = r.previous == null ? 0 : Math.round((r.value - r.previous) * 10) / 10;
		if (change !== 0) {
			return t("change", { value: `${change > 0 ? "+" : "−"}${format.number(Math.abs(change))} ${unit}`.trim() });
		}
		if (ruled) return t("normal");
		return r.previous == null ? t("first") : t("stable");
	};

	const results: Result[] = [];
	for (const arm of ARMS) {
		const sys = reading((v) => v[`bp${arm}Systolic`]);
		const dia = reading((v) => v[`bp${arm}Diastolic`]);
		if (!sys || !dia) continue;
		const abnormal = isAbnormal("systolic", sys.value) || isAbnormal("diastolic", dia.value);
		results.push({
			key: arm,
			icon: IconHeartPulse,
			label: short(`bp${arm}`),
			title: t(`bp.${arm}`),
			value: `${sys.value}/${dia.value}`,
			unit: "mmHg",
			abnormal,
			status: status(sys, abnormal, "", true),
		});
	}
	for (const { measure, rule, icon } of TILES) {
		const r = reading((v) => v[measure]);
		if (!r) continue;
		const abnormal = rule ? isAbnormal(rule, r.value) : false;
		const unit = MEASURES[measure].unit;
		results.push({
			key: measure,
			icon,
			label: short(measure),
			title: fields(measure),
			value: format.number(r.value),
			unit,
			abnormal,
			status: status(r, abnormal, unit, !!rule),
		});
	}
	const weight = reading((v) => v.weightKg);
	const height = reading((v) => v.heightCm);
	const bmi = weight && height ? bmiOf(weight.value, height.value) : null;
	if (bmi != null) {
		results.push({
			key: "bmi",
			icon: IconGauge,
			label: short("bmi"),
			title: fields("bmi"),
			value: format.number(bmi),
			abnormal: bmi >= 30 || bmi < 18.5,
			status: bmiLabel(bmiCategory(bmi)),
		});
	}
	const bloodGroup = entries.find((e) => e.vitals.bloodGroup)?.vitals.bloodGroup;
	if (bloodGroup) {
		results.push({ key: "blood", icon: IconDrop, label: short("bloodGroup"),
			title: fields("bloodGroup"), value: bloodGroup, abnormal: false, status: fields("bloodGroup") });
	}

	const unusual = results.filter((r) => r.abnormal);

	return (
		<section className="grid grid-cols-1 gap-3" aria-label={t("title")}>
			<SectionHeading
				title={t("title")}
				action={
					entries.length > 0 && (
						<button
							type="button"
							onClick={() => setOpen(true)}
							className="text-primary flex items-center gap-0.5 text-xs font-medium hover:underline"
						>
							{t("historyCount", { count: entries.length })} <IconChevronRight className="size-3.5 rtl:-scale-x-100" />
						</button>
					)
				}
			/>
			{loading ? (
				<div className="grid grid-cols-2 gap-2">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 rounded-xl" />
					))}
				</div>
			) : !latest ? (
				<p className="bg-card text-muted-foreground rounded-xl border px-4 py-3 text-xs">{t("empty")}</p>
			) : (
				<>
					<Eyebrow>
						{format.date(latest.vitals.measuredAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
						{" · "}
						{latest.vitals.recordedBy ?? t(`source.${latest.source}`)}
					</Eyebrow>
					{unusual.length > 0 && (
						<div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
							<div className="grid min-w-0 flex-1 gap-1">
								<Eyebrow className="text-amber-800">{t("watch")}</Eyebrow>
								<ul className="grid gap-0.5 text-sm font-medium">
									{unusual.map((r) => (
										<li key={r.key} className="flex justify-between gap-2">
											<span className="truncate">{r.title}</span>
											<span dir="ltr" className="shrink-0 tabular-nums">
												{r.value} {r.unit}
											</span>
										</li>
									))}
								</ul>
							</div>
							<IconWarning className="mt-0.5 size-4 shrink-0" />
						</div>
					)}
					<dl className="grid grid-cols-2 gap-2">
						{results.map((r) => (
							<SmallCard key={r.key} icon={r.icon} label={r.label} title={r.title}>
								<dd className="grid gap-0.5">
									<span
										dir="ltr"
										className={cn(
											"text-base font-semibold tabular-nums rtl:text-end",
											r.abnormal && "text-amber-700",
										)}
									>
										{r.value}
										{r.unit && <span className="text-muted-foreground ms-1 text-xs font-normal">{r.unit}</span>}
									</span>
									<span
										className={cn(
											"truncate text-xs",
											r.abnormal ? "text-amber-700" : "text-muted-foreground",
										)}
									>
										{r.status}
									</span>
								</dd>
							</SmallCard>
						))}
					</dl>
				</>
			)}

			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
					<div className="mx-auto grid w-full max-w-6xl gap-4 p-4">
						<SheetHeader className="p-0">
							<SheetTitle>{t("sheetTitle")}</SheetTitle>
							<SheetDescription>{t("sheetDescription", { count: entries.length })}</SheetDescription>
						</SheetHeader>
						<div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
							<TrendsCard points={points} />
							<ol className="grid gap-2">
								{entries.map(({ source, vitals: v }) => (
									<li key={`${source}-${v.id}`} className="bg-card grid gap-1.5 rounded-xl border p-3">
										<p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
											<span className="text-foreground font-medium">
												{format.date(v.measuredAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
											</span>
											<span className="bg-muted rounded px-1.5">{t(`source.${source}`)}</span>
											{v.recordedBy && <span>{v.recordedBy}</span>}
										</p>
										<VitalsChips
											vitals={v}
											bmi={bmiFor(
												v,
												entries.map((e) => e.vitals),
											)}
										/>
										{v.note && <p className="text-muted-foreground text-xs whitespace-pre-line">{v.note}</p>}
									</li>
								))}
							</ol>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</section>
	);
}

/** A measure's latest value, and the one before it when there is one. */
type Reading = { value: number; previous: number | null; date: string };

/** One result panel: the measure, its value, a word on it. */
type Result = { key: string; icon: AppIcon; label: string; title: string; value: string; unit?: string; abnormal: boolean; status: string };

/** The panels after the blood pressure, most looked-at first; the abnormal rule each follows. */
const TILES: { measure: Measure; icon: AppIcon; rule?: Parameters<typeof isAbnormal>[0] }[] = [
	{ measure: "heartRate", icon: IconActivity, rule: "heartRate" },
	{ measure: "spo2", icon: IconWind, rule: "spo2" },
	{ measure: "temperatureC", icon: IconThermometer, rule: "temperature" },
	{ measure: "weightKg", icon: IconWeight },
	{ measure: "heightCm", icon: IconRuler },
	{ measure: "glycemia", icon: IconDrop, rule: "glycemia" },
	{ measure: "glycemiaPostprandial", icon: IconDrop, rule: "glycemiaPostprandial" },
	{ measure: "hba1c", icon: IconLab, rule: "hba1c" },
	{ measure: "waistCm", icon: IconRuler },
	{ measure: "abdominalCircumferenceCm", icon: IconRuler },
	{ measure: "headCircumferenceCm", icon: IconRuler },
];
