"use client";

import { AlertTriangle, HeartPulse, Loader, Lock, Pencil } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { BLOOD_GROUPS, type MedicalProfile as Profile, PROFILE_FIELDS } from "@/lib/patients";
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
	onSaved,
}: {
	patientId: string;
	profile: Profile | null;
	readOnly: boolean;
	onSaved: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
	const [saving, setSaving] = useState(false);
	const filled = PROFILE_FIELDS.filter((f) => profile?.[f.name]);
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
				body: JSON.stringify({ ...draft, bloodGroup: draft.bloodGroup || null }),
			});
			toast.success("Antécédents enregistrés");
			setOpen(false);
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="grid gap-4">
			<div className="flex items-start justify-between gap-3">
				<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
					<Lock className="size-3.5" /> Visible uniquement par les médecins du cabinet
				</p>
				{!readOnly && !empty && (
					<Button size="sm" variant="outline" onClick={edit}>
						<Pencil /> Modifier
					</Button>
				)}
			</div>

			{empty ? (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
					<HeartPulse className="text-muted-foreground size-6" />
					<div>
						<p className="text-sm font-medium">Aucun antécédent renseigné</p>
						<p className="text-muted-foreground text-sm">Allergies, traitements, maladies chroniques, groupe sanguin…</p>
					</div>
					{!readOnly && (
						<Button size="sm" onClick={edit}>
							Renseigner les antécédents
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-3">
					{profile?.bloodGroup && (
						<div className="flex items-center justify-between rounded-xl border px-4 py-3">
							<span className="text-muted-foreground text-sm">Groupe sanguin</span>
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
										{alert && <AlertTriangle className="size-3.5" />}
										{f.label}
									</dt>
									<dd className="text-sm whitespace-pre-line">{profile?.[f.name]}</dd>
								</div>
							);
						})}
					</dl>
					{profile && (
						<p className="text-muted-foreground text-xs">Mis à jour le {formatDate(profile.updatedAt)}</p>
					)}
				</div>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Antécédents</DialogTitle>
						<DialogDescription>Visibles uniquement par les médecins du cabinet.</DialogDescription>
					</DialogHeader>
					<FieldGroup className="max-h-[60vh] gap-4 overflow-y-auto pe-1">
						<Field>
							<FieldLabel>Groupe sanguin</FieldLabel>
							<div role="radiogroup" aria-label="Groupe sanguin" className="flex flex-wrap gap-1.5">
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
										{g || "Inconnu"}
									</button>
								))}
							</div>
						</Field>
						{PROFILE_FIELDS.map((f) => (
							<Field key={f.name}>
								<FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
								<Textarea
									id={f.name}
									rows={2}
									placeholder={"placeholder" in f ? f.placeholder : undefined}
									value={draft[f.name]}
									onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))}
								/>
							</Field>
						))}
					</FieldGroup>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Annuler
						</Button>
						<Button onClick={save} disabled={saving}>
							{saving && <Loader className="animate-spin" />} Enregistrer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
