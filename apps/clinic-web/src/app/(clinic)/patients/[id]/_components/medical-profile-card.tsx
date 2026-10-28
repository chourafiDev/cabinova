"use client";

import { AlertTriangle, Loader, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { BLOOD_GROUPS, type MedicalProfile, PROFILE_FIELDS } from "@/lib/patients";
import { FormCard } from "../../../_components/form-card";

type Draft = Record<(typeof PROFILE_FIELDS)[number]["name"], string> & { bloodGroup: string };

const NONE = "none";

const toDraft = (p: MedicalProfile | null): Draft => ({
	bloodGroup: p?.bloodGroup ?? NONE,
	...(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.name, p?.[f.name] ?? ""])) as Omit<Draft, "bloodGroup">),
});

/** Antécédents: doctors only. Allergies stand out — they matter at every visit. */
export function MedicalProfileCard({
	patientId,
	profile,
	readOnly,
}: {
	patientId: string;
	profile: MedicalProfile | null;
	readOnly: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
	const [saving, setSaving] = useState(false);
	const filled = PROFILE_FIELDS.filter((f) => profile?.[f.name]);

	const save = async () => {
		setSaving(true);
		try {
			await api(`/patients/${patientId}/medical-profile`, {
				method: "PUT",
				body: JSON.stringify({ ...draft, bloodGroup: draft.bloodGroup === NONE ? null : draft.bloodGroup }),
			});
			toast.success("Antécédents enregistrés");
			setOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<FormCard
			title="Antécédents"
			action={
				!readOnly && (
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							setDraft(toDraft(profile));
							setOpen(true);
						}}
					>
						<Pencil /> Modifier
					</Button>
				)
			}
		>
			{!profile?.bloodGroup && filled.length === 0 ? (
				<p className="text-muted-foreground text-sm">Aucun antécédent renseigné.</p>
			) : (
				<dl className="grid gap-3 text-sm">
					{profile?.bloodGroup && (
						<div>
							<dt className="text-muted-foreground text-xs">Groupe sanguin</dt>
							<dd className="font-medium">{profile.bloodGroup}</dd>
						</div>
					)}
					{filled.map((f) => (
						<div
							key={f.name}
							className={
								"alert" in f && f.alert ? "rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-900" : undefined
							}
						>
							<dt className="flex items-center gap-1.5 text-xs font-medium">
								{"alert" in f && f.alert && <AlertTriangle className="size-3.5" />}
								<span className={"alert" in f && f.alert ? undefined : "text-muted-foreground font-normal"}>
									{f.label}
								</span>
							</dt>
							<dd className="whitespace-pre-line">{profile?.[f.name]}</dd>
						</div>
					))}
					{profile && (
						<p className="text-muted-foreground text-xs">Mis à jour le {formatDate(profile.updatedAt, { month: "short" })}</p>
					)}
				</dl>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Antécédents</DialogTitle>
						<DialogDescription>Visibles uniquement par les médecins du cabinet.</DialogDescription>
					</DialogHeader>
					<FieldGroup className="max-h-[60vh] gap-4 overflow-y-auto pe-1">
						<Field>
							<FieldLabel htmlFor="bloodGroup">Groupe sanguin</FieldLabel>
							<Select value={draft.bloodGroup} onValueChange={(v) => setDraft((d) => ({ ...d, bloodGroup: v }))}>
								<SelectTrigger id="bloodGroup" className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>Non renseigné</SelectItem>
									{BLOOD_GROUPS.map((g) => (
										<SelectItem key={g} value={g}>
											{g}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
		</FormCard>
	);
}
