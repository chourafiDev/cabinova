"use client";

import { useTranslations } from "next-intl";
import { LuHeartPulse, LuLoader, LuLock, LuPencil, LuTriangleAlert } from "react-icons/lu";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { BLOOD_GROUPS, type MedicalProfile as Profile, PROFILE_FIELDS, type Sex } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

type Draft = Record<(typeof PROFILE_FIELDS)[number]["name"], string> & { bloodGroup: string };

const toDraft = (p: Profile | null): Draft => ({
	bloodGroup: p?.bloodGroup ?? "",
	...(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.name, p?.[f.name] ?? ""])) as Omit<Draft, "bloodGroup">),
});

/**
 * Antécédents, doctors only: blood group and the medical history, read as
 * a clean list; edited in a dialog. Allergies stand out — they matter at
 * every visit.
 */
export function MedicalProfile({
	patientId,
	profile,
	readOnly,
	sex,
	onSaved,
}: {
	patientId: string;
	profile: Profile | null;
	readOnly: boolean;
	/** Gyneco-obstetric history is asked for women only. */
	sex?: Sex;
	onSaved: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
	const [saving, setSaving] = useState(false);
	const t = useTranslations("patients.medical");
	const format = useFormat();
	const fields = PROFILE_FIELDS.filter((f) => !("female" in f) || sex !== "male");
	const filled = fields.filter((f) => profile?.[f.name]);
	const empty = !profile?.bloodGroup && filled.length === 0;

	const edit = () => {
		setDraft(toDraft(profile));
		setOpen(true);
	};
	const save = async () => {
		setSaving(true);
		try {
			await api(`/patients/${patientId}/medical-profile`, {
				method: "PUT",
				// The permanent note is edited on its own: kept as it is.
				body: JSON.stringify({ ...draft, bloodGroup: draft.bloodGroup || null, permanentNote: profile?.permanentNote ?? null }),
			});
			toast.success(t("saved"));
			setOpen(false);
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="grid gap-4">
			<div className="flex items-start justify-between gap-3">
				<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
					<LuLock className="size-3.5" /> {t("privateLine")}
				</p>
				{!readOnly && !empty && (
					<Button size="sm" variant="outline" onClick={edit}>
						<LuPencil /> {t("edit")}
					</Button>
				)}
			</div>

			{empty ? (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
					<LuHeartPulse className="text-muted-foreground size-6" />
					<div>
						<p className="text-sm font-medium">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">{t("emptyHint")}</p>
					</div>
					{!readOnly && (
						<Button size="sm" onClick={edit}>
							{t("fill")}
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-3">
					{profile?.bloodGroup && (
						<div className="flex items-center justify-between rounded-xl border px-4 py-3">
							<span className="text-muted-foreground text-sm">{t("bloodGroup")}</span>
							<span className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-sm font-semibold text-red-700">
								{profile.bloodGroup}
							</span>
						</div>
					)}
					<dl className="divide-y rounded-xl border">
						{filled.map((f) => {
							const alert = "alert" in f && f.alert;
							return (
								<div key={f.name} className={cn("grid gap-1 px-4 py-3", alert && "bg-red-50 text-red-900")}>
									<dt
										className={cn(
											"flex items-center gap-1.5 text-xs font-medium",
											!alert && "text-muted-foreground",
										)}
									>
										{alert && <LuTriangleAlert className="size-3.5" />}
										{t(`fields.${f.name}`)}
									</dt>
									<dd className="text-sm whitespace-pre-line">{profile?.[f.name]}</dd>
								</div>
							);
						})}
					</dl>
					{profile && (
						<p className="text-muted-foreground text-xs">{t("updatedOn", { date: format.date(profile.updatedAt) })}</p>
					)}
				</div>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("title")}</DialogTitle>
						<DialogDescription>{t("privateDescription")}</DialogDescription>
					</DialogHeader>
					<FieldGroup className="max-h-[60vh] gap-4 overflow-y-auto pe-1">
						<Field>
							<FieldLabel>{t("bloodGroup")}</FieldLabel>
							<div role="radiogroup" aria-label={t("bloodGroup")} dir="ltr" className="flex flex-wrap gap-1.5">
								{["", ...BLOOD_GROUPS].map((g) => (
									<button
										key={g || "none"}
										type="button"
										role="radio"
										aria-checked={draft.bloodGroup === g}
										onClick={() => setDraft((d) => ({ ...d, bloodGroup: g }))}
										className={cn(
											"h-8 rounded-lg border px-3 text-sm transition-colors",
											g && "font-mono",
											draft.bloodGroup === g
												? "border-primary bg-primary text-primary-foreground font-medium"
												: "text-muted-foreground hover:bg-muted",
										)}
									>
										{g || t("unknown")}
									</button>
								))}
							</div>
						</Field>
						{fields.map((f) => (
							<Field key={f.name}>
								<FieldLabel htmlFor={f.name}>{t(`fields.${f.name}`)}</FieldLabel>
								<Textarea
									id={f.name}
									rows={2}
									placeholder={"placeholder" in f ? t(`placeholders.${f.name}`) : undefined}
									value={draft[f.name]}
									onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))}
								/>
							</Field>
						))}
					</FieldGroup>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							{t("cancel")}
						</Button>
						<Button onClick={save} disabled={saving}>
							{saving && <LuLoader className="animate-spin" />} {t("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
