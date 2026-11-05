"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuActivity, LuArrowDown, LuArrowUp, LuDroplet, LuHistory, LuTriangleAlert } from "react-icons/lu";
import { VitalsChips } from "@/components/vitals-chips";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { moroccoDay } from "@cabinova/morocco-time";
import { bmiCategory, bmiOf, type Consultation, isAbnormal, VITAL_FIELDS, type VitalField } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ARMS, bmiFor, MEASURES, type Measure, type VitalSigns } from "@/lib/vitals";
import { Card } from "./patient-aside";
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
	const bloodGroup = entries.find((e) => e.vitals.bloodGroup)?.vitals.bloodGroup;
	const arms = ARMS.map((arm) => ({
		arm,
		systolic: reading((v) => v[`bp${arm}Systolic`]),
		diastolic: reading((v) => v[`bp${arm}Diastolic`]),
	})).filter((a) => a.systolic && a.diastolic);
	const weight = reading((v) => v.weightKg);
	const height = reading((v) => v.heightCm);
	const bmi = weight && height ? bmiOf(weight.value, height.value) : null;
	const tiles = TILES.map(({ measure, rule }) => ({ measure, rule, reading: reading((v) => v[measure]) })).filter(
		(tile) => tile.reading,
	);
	const sizes = SIZES.map((measure) => ({ measure, reading: reading((v) => v[measure]) })).filter((s) => s.reading);
	/** A value from an older measurement than the latest shows its own date. */
	const olderDate = (date: string) =>
		latest && moroccoDay(new Date(date)) !== moroccoDay(new Date(latest.vitals.measuredAt))
			? format.date(date, { day: "numeric", month: "short" })
			: null;

	return (
		<Card
			icon={LuActivity}
			title={t("title")}
			aside={
				<Button size="xs" variant="outline" onClick={() => setOpen(true)} disabled={entries.length === 0}>
					<LuHistory /> {t("history")}
				</Button>
			}
		>
			{loading ? (
				<div className="grid grid-cols-2 gap-2">
					<Skeleton className="col-span-2 h-16" />
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
			) : !latest ? (
				<div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
					<LuActivity className="text-muted-foreground size-5" />
					<p className="text-muted-foreground text-xs">{t("empty")}</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3">
					<div className="flex items-center justify-between gap-2">
						<p className="text-muted-foreground min-w-0 truncate text-xs">
							{format.date(latest.vitals.measuredAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
							{" · "}
							{t(`source.${latest.source}`)}
							{latest.vitals.recordedBy && ` · ${latest.vitals.recordedBy}`}
						</p>
						{bloodGroup && (
							<span
								className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
								title={fields("bloodGroup")}
							>
								<LuDroplet className="size-3" /> {bloodGroup}
							</span>
						)}
					</div>

					<div className="grid grid-cols-2 gap-2">
						{arms.length > 0 && (
							<Tile
								wide
								label={t("bloodPressure")}
								unit="mmHg"
								abnormal={arms.some(
									(a) => isAbnormal("systolic", a.systolic!.value) || isAbnormal("diastolic", a.diastolic!.value),
								)}
							>
								<div className="flex flex-wrap gap-x-5 gap-y-1">
									{arms.map(({ arm, systolic, diastolic }) => (
										<div key={arm} className="grid">
											<span className="text-muted-foreground text-[11px]">{t(`arm.${arm}`)}</span>
											<span
												className={cn(
													"text-lg leading-tight font-semibold tabular-nums",
													(isAbnormal("systolic", systolic!.value) || isAbnormal("diastolic", diastolic!.value)) &&
														"text-amber-700 dark:text-amber-300",
												)}
											>
												{systolic!.value}/{diastolic!.value}
											</span>
											{olderDate(systolic!.date) && (
												<span className="text-muted-foreground text-[11px]">{olderDate(systolic!.date)}</span>
											)}
										</div>
									))}
								</div>
							</Tile>
						)}
						{tiles.map(({ measure, rule, reading: r }) => (
							<Tile
								key={measure}
								label={fields(measure)}
								unit={MEASURES[measure].unit}
								abnormal={rule ? isAbnormal(rule, r!.value) : false}
								reading={r!}
								older={olderDate(r!.date)}
							/>
						))}
						{bmi != null && (
							<Tile label={fields("bmi")} abnormal={bmi >= 30 || bmi < 18.5} reading={{ value: bmi, previous: null, date: "" }}>
								<span className="text-muted-foreground text-[11px]">{bmiLabel(bmiCategory(bmi))}</span>
							</Tile>
						)}
					</div>

					{sizes.length > 0 && (
						<dl className="grid gap-1.5 border-t pt-3 text-xs">
							{sizes.map(({ measure, reading: r }) => (
								<div key={measure} className="flex items-baseline justify-between gap-3">
									<dt className="text-muted-foreground truncate">{fields(measure)}</dt>
									<dd className="shrink-0 tabular-nums">
										<span className="font-medium">{format.number(r!.value)}</span> {MEASURES[measure].unit}
										{olderDate(r!.date) && <span className="text-muted-foreground"> · {olderDate(r!.date)}</span>}
									</dd>
								</div>
							))}
						</dl>
					)}
				</div>
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
		</Card>
	);
}

/** A measure's latest value, and the one before it when there is one. */
type Reading = { value: number; previous: number | null; date: string };

/** The tiles, most looked-at first; the abnormal rule each follows. */
const TILES: { measure: Measure; rule?: Parameters<typeof isAbnormal>[0] }[] = [
	{ measure: "heartRate", rule: "heartRate" },
	{ measure: "spo2", rule: "spo2" },
	{ measure: "temperatureC", rule: "temperature" },
	{ measure: "weightKg" },
	{ measure: "heightCm" },
	{ measure: "glycemia", rule: "glycemia" },
	{ measure: "glycemiaPostprandial", rule: "glycemiaPostprandial" },
	{ measure: "hba1c", rule: "hba1c" },
];
/** Body measurements: looked at less, listed under the tiles. */
const SIZES: Measure[] = ["waistCm", "abdominalCircumferenceCm", "headCircumferenceCm"];

/** One constante: label, value large with its unit, the change since last time; amber when unusual. */
function Tile({
	label,
	unit,
	abnormal,
	reading,
	older,
	wide,
	children,
}: {
	label: string;
	unit?: string;
	abnormal: boolean;
	reading?: Reading;
	older?: string | null;
	wide?: boolean;
	children?: React.ReactNode;
}) {
	const t = useTranslations("dossier.latest");
	const format = useFormat();
	const change = reading && reading.previous != null ? Math.round((reading.value - reading.previous) * 10) / 10 : 0;
	return (
		<div
			className={cn(
				"grid content-start gap-1 rounded-lg border p-2.5",
				wide && "col-span-2",
				abnormal
					? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
					: "bg-muted/40 border-transparent",
			)}
		>
			<p className="text-muted-foreground flex items-center gap-1 text-[11px] leading-tight">
				<span className="min-w-0 truncate" title={label}>
					{label}
				</span>
				{abnormal && (
					<LuTriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("unusual")} />
				)}
				{wide && unit && <span className="ms-auto shrink-0">{unit}</span>}
			</p>
			{reading && (
				<p className="flex flex-wrap items-baseline gap-x-1">
					<span
						className={cn(
							"text-lg leading-tight font-semibold tabular-nums",
							abnormal && "text-amber-700 dark:text-amber-300",
						)}
					>
						{format.number(reading.value)}
					</span>
					{unit && <span className="text-muted-foreground text-xs">{unit}</span>}
				</p>
			)}
			{children}
			{reading && (change !== 0 || older) && (
				<p className="text-muted-foreground flex items-center gap-1.5 text-[11px] tabular-nums">
					{change !== 0 && (
						<span className="flex items-center gap-0.5" title={t("previous", { value: format.number(reading.previous!) })}>
							{change > 0 ? <LuArrowUp className="size-3" /> : <LuArrowDown className="size-3" />}
							{format.number(Math.abs(change))}
						</span>
					)}
					{older && <span>{older}</span>}
				</p>
			)}
		</div>
	);
}
