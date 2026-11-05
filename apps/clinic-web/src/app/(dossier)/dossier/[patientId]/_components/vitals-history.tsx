"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuActivity, LuHistory } from "react-icons/lu";
import { VitalsChips } from "@/components/vitals-chips";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { bmiOf, type Consultation, VITAL_FIELDS, type VitalField } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { bmiFor, MEASURES, type Measure, type VitalSigns } from "@/lib/vitals";
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
	const format = useFormat();
	const [open, setOpen] = useState(false);

	// Each measure from the newest measurement that has it.
	const latest = entries[0] && {
		...entries[0].vitals,
		...Object.fromEntries(
			(Object.keys(MEASURES) as Measure[]).map((m) => [m, entries.find((e) => e.vitals[m] != null)?.vitals[m] ?? null]),
		),
		bloodGroup: entries.find((e) => e.vitals.bloodGroup)?.vitals.bloodGroup ?? null,
	};

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
				<Skeleton className="h-14" />
			) : !latest ? (
				<p className="text-muted-foreground text-xs">{t("empty")}</p>
			) : (
				<div className="grid gap-2">
					<p className="text-muted-foreground text-xs">{t("lastOn", { date: format.date(latest.measuredAt) })}</p>
					<VitalsChips vitals={latest} bmi={bmiOf(latest.weightKg, latest.heightCm)} />
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
