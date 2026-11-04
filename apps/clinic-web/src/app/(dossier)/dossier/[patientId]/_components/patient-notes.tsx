"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuBellRing, LuLoader, LuPencil, LuPin, LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { PastConsultation } from "@/lib/consultations";
import type { PatientFile } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";

/**
 * Above the consultation, what the doctor must not miss: the patient's
 * permanent note ("malentendant, parler fort"), and what the last visit
 * asked to check today ("contrôler la TA").
 */
export function PatientNotes({ patient, last }: { patient: PatientFile; last: PastConsultation | undefined }) {
	const t = useTranslations("dossier.notes");
	const fmt = useFormat();
	const queryClient = useQueryClient();
	const permanent = patient.medicalProfile?.permanentNote ?? null;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(permanent ?? "");
	const [saving, setSaving] = useState(false);

	async function save() {
		setSaving(true);
		try {
			// The whole profile goes back, with only the note changed.
			const profile = patient.medicalProfile;
			await api(`/patients/${patient.id}/medical-profile`, {
				method: "PUT",
				body: JSON.stringify({
					bloodGroup: profile?.bloodGroup ?? null,
					allergies: profile?.allergies ?? null,
					chronicConditions: profile?.chronicConditions ?? null,
					medicalHistory: profile?.medicalHistory ?? null,
					surgicalHistory: profile?.surgicalHistory ?? null,
					familyHistory: profile?.familyHistory ?? null,
					currentTreatments: profile?.currentTreatments ?? null,
					toxicHabits: profile?.toxicHabits ?? null,
					gynecoHistory: profile?.gynecoHistory ?? null,
					riskFactors: profile?.riskFactors ?? null,
					permanentNote: draft,
				}),
			});
			await queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
			setEditing(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	}

	const reminder = last?.nextVisitNote;

	return (
		<div className="grid gap-2">
			{reminder && (
				<div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
					<LuBellRing className="mt-0.5 size-4 shrink-0" />
					<div className="min-w-0 text-sm">
						<p className="font-semibold">{t("reminder", { date: fmt.date(last.date) })}</p>
						<p className="whitespace-pre-line">{reminder}</p>
					</div>
				</div>
			)}

			{editing ? (
				<div className="bg-card grid gap-2 rounded-xl border p-3">
					<label htmlFor="permanent-note" className="flex items-center gap-1.5 text-xs font-medium">
						<LuPin className="size-3.5" /> {t("permanent")}
					</label>
					<Textarea
						id="permanent-note"
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder={t("permanentPlaceholder")}
						maxLength={1000}
						className="field-sizing-content min-h-12 resize-none"
					/>
					<div className="flex justify-end gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setDraft(permanent ?? "");
								setEditing(false);
							}}
						>
							{t("cancel")}
						</Button>
						<Button size="sm" onClick={save} disabled={saving}>
							{saving && <LuLoader className="animate-spin" />} {t("save")}
						</Button>
					</div>
				</div>
			) : permanent ? (
				<div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800">
					<LuPin className="mt-0.5 size-4 shrink-0" />
					<div className="min-w-0 flex-1 text-sm">
						<p className="font-semibold">{t("permanent")}</p>
						<p className="whitespace-pre-line">{permanent}</p>
					</div>
					<Button size="icon-sm" variant="ghost" aria-label={t("edit")} onClick={() => setEditing(true)}>
						<LuPencil />
					</Button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setEditing(true)}
					className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-xs"
				>
					<LuPlus className="size-3.5" /> {t("add")}
				</button>
			)}
		</div>
	);
}
