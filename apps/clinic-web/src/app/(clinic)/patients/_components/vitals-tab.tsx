"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuActivity, LuHeartPulse, LuLoader, LuRuler, LuThermometer } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { bmiOf, bmiCategory, toNumber } from "@/lib/consultations";
import { BLOOD_GROUPS } from "@/lib/patients";
import { ARMS, INTEGER_MEASURES, MEASURES, type Measure, SECTIONS, type VitalSigns, vitalsKey } from "@/lib/vitals";

const ICONS = { general: LuRuler, endocrinology: LuActivity, cardio: LuHeartPulse, other: LuThermometer } as const;
const NONE = "none";

type Draft = Record<Measure, string> & { bloodGroup: string; note: string };

const empty = (): Draft => ({
	...(Object.fromEntries(Object.keys(MEASURES).map((m) => [m, ""])) as Record<Measure, string>),
	bloodGroup: NONE,
	note: "",
});

/** What's wrong with a typed value, or null. */
function problem(measure: Measure, text: string) {
	const value = toNumber(text);
	if (text.trim() === "") return null;
	const { min, max } = MEASURES[measure];
	if (value === null || value < min || value > max || (INTEGER_MEASURES.has(measure) && !Number.isInteger(value))) {
		return { min, max };
	}
	return null;
}

/**
 * Constantes, for the whole staff: the secretary takes them at the front
 * desk, the doctor reads the history in the patient's dossier.
 */
export function VitalsTab({ patientId, archived }: { patientId: string; archived: boolean }) {
	const t = useTranslations("patients.vitals");
	const queryClient = useQueryClient();
	const vitals = useQuery({
		queryKey: vitalsKey(patientId),
		queryFn: () => api<VitalSigns[]>(`/patients/${patientId}/vitals`),
	});
	const [draft, setDraft] = useState<Draft>(empty);
	const [showErrors, setShowErrors] = useState(false);
	const set = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
	const refresh = () => queryClient.invalidateQueries({ queryKey: vitalsKey(patientId) });

	const lastHeight = vitals.data?.find((v) => v.heightCm != null)?.heightCm ?? null;
	const bmi = bmiOf(toNumber(draft.weightKg), toNumber(draft.heightCm) ?? lastHeight);
	const invalid = (Object.keys(MEASURES) as Measure[]).some((m) => problem(m, draft[m]));
	const filled = (Object.keys(MEASURES) as Measure[]).some((m) => draft[m].trim() !== "") || draft.bloodGroup !== NONE;
	const halfPressure = ARMS.some((arm) => (draft[`bp${arm}Systolic`].trim() === "") !== (draft[`bp${arm}Diastolic`].trim() === ""));

	const save = useMutation({
		mutationFn: () =>
			api<VitalSigns>(`/patients/${patientId}/vitals`, {
				method: "POST",
				body: JSON.stringify({
					...Object.fromEntries((Object.keys(MEASURES) as Measure[]).map((m) => [m, toNumber(draft[m])])),
					bloodGroup: draft.bloodGroup === NONE ? null : draft.bloodGroup,
					note: draft.note.trim() || null,
				}),
			}),
		onSuccess: () => {
			toast.success(t("saved"));
			setDraft(empty());
			setShowErrors(false);
			void refresh();
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : t("saveError")),
	});

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		setShowErrors(true);
		if (!filled || invalid || halfPressure) return;
		save.mutate();
	};

	const field = (measure: Measure, label: string) => {
		const issue = showErrors || draft[measure] ? problem(measure, draft[measure]) : null;
		return (
			<label key={measure} className="grid gap-1 text-sm">
				<span className="text-muted-foreground text-xs">{label}</span>
				<span className="relative">
					<Input
						inputMode="decimal"
						value={draft[measure]}
						onChange={(e) => set(measure, e.target.value)}
						aria-invalid={!!issue}
						className="pe-14 tabular-nums"
					/>
					<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs">
						{MEASURES[measure].unit}
					</span>
				</span>
				{issue && <span className="text-destructive text-xs">{t("range", issue)}</span>}
			</label>
		);
	};

	return (
		<div className="grid gap-5">
			{archived ? (
				<p className="bg-muted/60 rounded-xl px-4 py-3 text-sm">{t("archived")}</p>
			) : (
				<form onSubmit={submit} noValidate className="grid gap-4">
					{SECTIONS.map(({ key, measures }) => {
						const Icon = ICONS[key];
						return (
							<fieldset key={key} className="rounded-xl border p-4">
								<legend className="flex items-center gap-2 px-1 text-sm font-semibold">
									<Icon className="text-primary size-4" /> {t(`groups.${key}`)}
								</legend>
								<div className="grid gap-3 sm:grid-cols-3">
									{key === "cardio" &&
										ARMS.map((arm) => (
											<div key={arm} className="grid gap-1 text-sm sm:col-span-3">
												<span className="text-muted-foreground text-xs">{t(`bp${arm}`)}</span>
												<div className="grid grid-cols-2 gap-3 sm:max-w-sm">
													{field(`bp${arm}Systolic`, t("systolic"))}
													{field(`bp${arm}Diastolic`, t("diastolic"))}
												</div>
											</div>
										))}
									{measures.map((m) => field(m, t(`fields.${m}`)))}
									{key === "general" && (
										<>
											<div className="grid gap-1 text-sm">
												<span className="text-muted-foreground text-xs">{t("fields.bmi")}</span>
												<p className="bg-muted/60 flex h-9 items-center gap-2 rounded-lg border px-2.5 tabular-nums">
													{bmi ?? "—"}
													{bmi != null && <span className="text-muted-foreground text-xs">{t(`bmiCategory.${bmiCategory(bmi)}`)}</span>}
												</p>
												<span className="text-muted-foreground text-xs">{t("bmiAuto")}</span>
											</div>
											<label className="grid gap-1 text-sm">
												<span className="text-muted-foreground text-xs">{t("fields.bloodGroup")}</span>
												<Select value={draft.bloodGroup} onValueChange={(v) => set("bloodGroup", v)}>
													<SelectTrigger className="w-full">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={NONE}>{t("noBloodGroup")}</SelectItem>
														{BLOOD_GROUPS.map((g) => (
															<SelectItem key={g} value={g} dir="ltr">
																{g}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</label>
										</>
									)}
								</div>
							</fieldset>
						);
					})}

					<label className="grid gap-1 text-sm">
						<span className="text-muted-foreground text-xs">{t("note")}</span>
						<Textarea rows={2} maxLength={500} value={draft.note} placeholder={t("notePlaceholder")} onChange={(e) => set("note", e.target.value)} />
					</label>

					{showErrors && (!filled || halfPressure) && (
						<p role="alert" className="text-destructive text-sm">
							{!filled ? t("emptyForm") : t("halfPressure")}
						</p>
					)}
					<div className="flex justify-end">
						<Button type="submit" disabled={save.isPending}>
							{save.isPending && <LuLoader className="animate-spin" />} {t("save")}
						</Button>
					</div>
				</form>
			)}

		</div>
	);
}
