"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { FEATURE_STATUS_LABELS, type Feature, type FeatureStatus } from "@/lib/features";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";

const HINTS: Record<FeatureStatus, string> = {
	active: "Disponible selon les offres et les exceptions.",
	beta: "Réservée aux cabinets testeurs (exceptions), quelle que soit l’offre.",
	disabled: "Coupée pour tous les cabinets, exceptions comprises — en cas d’incident.",
};

/** Name, category, description, and the status switch (with the kill switch). */
export function FeatureSettings({ feature, readOnly }: { feature: Feature; readOnly: boolean }) {
	const router = useRouter();
	const [form, setForm] = useState({
		name: feature.name,
		category: feature.category ?? "",
		description: feature.description ?? "",
		status: feature.status,
		disabledReason: feature.disabledReason ?? "",
	});
	const [saving, setSaving] = useState(false);
	const dirty =
		form.name !== feature.name ||
		form.category !== (feature.category ?? "") ||
		form.description !== (feature.description ?? "") ||
		form.status !== feature.status ||
		form.disabledReason !== (feature.disabledReason ?? "");
	const reasonMissing = form.status === "disabled" && form.disabledReason.trim().length < 3;

	const save = async () => {
		setSaving(true);
		try {
			await api(`/features/${feature.key}`, {
				method: "PATCH",
				body: JSON.stringify({ ...form, sortOrder: feature.sortOrder }),
			});
			toast.success(
				form.status !== feature.status
					? `${form.name} : ${FEATURE_STATUS_LABELS[form.status].toLowerCase()}`
					: "Fonctionnalité mise à jour",
			);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<FormCard title="Réglages">
			<div className="grid gap-4">
				<Field>
					<FieldLabel>Statut</FieldLabel>
					<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Statut">
						{(["active", "beta", "disabled"] as const).map((s) => (
							<button
								key={s}
								type="button"
								role="radio"
								aria-checked={form.status === s}
								disabled={readOnly}
								onClick={() => setForm((f) => ({ ...f, status: s }))}
								className={cn(
									"flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
									form.status === s && "bg-background text-foreground shadow-sm",
									form.status === s && s === "disabled" && "bg-red-600 text-white",
								)}
							>
								{s === "disabled" && <Power className="size-3.5" />}
								{FEATURE_STATUS_LABELS[s]}
							</button>
						))}
					</div>
					<FieldDescription>{HINTS[form.status]}</FieldDescription>
				</Field>
				{form.status === "disabled" && (
					<Field data-invalid={reasonMissing}>
						<FieldLabel htmlFor="ft-reason">Motif de la désactivation</FieldLabel>
						<Input
							id="ft-reason"
							disabled={readOnly}
							placeholder="Panne du fournisseur SMS, faille corrigée en cours…"
							value={form.disabledReason}
							onChange={(e) => setForm((f) => ({ ...f, disabledReason: e.target.value }))}
						/>
						{reasonMissing && <FieldError errors={[{ message: "Indiquez le motif (3 caractères min.)" }]} />}
					</Field>
				)}
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="ft-name">Nom</FieldLabel>
						<Input id="ft-name" disabled={readOnly} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
					</Field>
					<Field>
						<FieldLabel htmlFor="ft-cat">Catégorie</FieldLabel>
						<Input id="ft-cat" disabled={readOnly} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="ft-desc">Description</FieldLabel>
					<Input id="ft-desc" disabled={readOnly} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
				</Field>
				{!readOnly && (
					<div className="flex justify-end">
						<Button
							onClick={save}
							disabled={!dirty || saving || reasonMissing || form.name.trim().length < 2}
							variant={form.status === "disabled" && feature.status !== "disabled" ? "destructive" : "default"}
						>
							{form.status === "disabled" && feature.status !== "disabled" ? "Désactiver partout" : "Enregistrer"}
						</Button>
					</div>
				)}
			</div>
		</FormCard>
	);
}
