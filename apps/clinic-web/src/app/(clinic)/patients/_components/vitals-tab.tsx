"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format as formatDay } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuActivity, LuHeartPulse, LuLoader, LuRuler, LuThermometer, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { VitalsChips } from "@/components/vitals-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { bmiOf, bmiCategory, toNumber } from "@/lib/consultations";
import { BLOOD_GROUPS } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ARMS, bmiFor, INTEGER_MEASURES, MEASURES, type Measure, SECTIONS, type VitalSigns, vitalsKey } from "@/lib/vitals";

const ICONS = { general: LuRuler, endocrinology: LuActivity, cardio: LuHeartPulse, other: LuThermometer } as const;
const NONE = "none";

type Draft = Record<Measure, string> & { bloodGroup: string; note: string; measuredAt: string };

const now = () => formatDay(new Date(), "yyyy-MM-dd'T'HH:mm");
const empty = (): Draft => ({
	...(Object.fromEntries(Object.keys(MEASURES).map((m) => [m, ""])) as Record<Measure, string>),
	bloodGroup: NONE,
	note: "",
	measuredAt: now(),
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
 * desk, the doctor finds them in the patient's dossier.
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
					measuredAt: new Date(draft.measuredAt).toISOString(),
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
					<label className="grid max-w-xs gap-1 text-sm">
						<span className="text-muted-foreground text-xs">{t("measuredAt")}</span>
						<Input type="datetime-local" value={draft.measuredAt} max={now()} onChange={(e) => set("measuredAt", e.target.value)} />
					</label>

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

			<History patientId={patientId} vitals={vitals.data} loading={vitals.isPending} onChanged={refresh} />
		</div>
	);
}

function History({
	patientId,
	vitals,
	loading,
	onChanged,
}: {
	patientId: string;
	vitals: VitalSigns[] | undefined;
	loading: boolean;
	onChanged: () => void;
}) {
	const t = useTranslations("patients.vitals");
	const user = useCurrentUser();
	const format = useFormat();
	const [confirming, setConfirming] = useState<string | null>(null);
	const remove = useMutation({
		mutationFn: (id: string) => api(`/patients/${patientId}/vitals/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			toast.success(t("deleted"));
			setConfirming(null);
			onChanged();
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : t("saveError")),
	});

	return (
		<section className="grid gap-2">
			<h3 className="text-sm font-semibold">{t("history")}</h3>
			{loading ? (
				<Skeleton className="h-20" />
			) : !vitals?.length ? (
				<p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">{t("empty")}</p>
			) : (
				<ul className="divide-y rounded-xl border">
					{vitals.map((v) => (
						<li key={v.id} className="grid gap-1.5 px-4 py-3">
							<div className="flex items-center gap-2">
								<p className="text-muted-foreground min-w-0 flex-1 text-xs">
									{format.date(v.measuredAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
									{v.recordedBy && ` · ${t("by", { name: v.recordedBy })}`}
								</p>
								{(user.role === "owner" || v.recordedById === user.id) &&
									(confirming === v.id ? (
										<Button size="sm" variant="destructive" className="h-7" disabled={remove.isPending} onClick={() => remove.mutate(v.id)}>
											{t("confirmDelete")}
										</Button>
									) : (
										<Button
											size="icon"
											variant="ghost"
											className="text-muted-foreground size-7"
											aria-label={t("delete")}
											onClick={() => setConfirming(v.id)}
										>
											<LuTrash2 />
										</Button>
									))}
							</div>
							<VitalsChips vitals={v} bmi={bmiFor(v, vitals)} />
							{v.note && <p className={cn("text-muted-foreground text-xs whitespace-pre-line")}>{v.note}</p>}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
