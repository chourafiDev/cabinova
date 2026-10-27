"use client";

import { CodeXml, Power, Trash2 } from "lucide-react";
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
	DialogTrigger,
} from "@/components/ui/dialog";
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

/**
 * The status switch (active / beta / kill switch). Name, category and
 * description come from the code registry and are shown read-only. A
 * feature absent from the code can only be deleted.
 */
export function FeatureSettings({ feature, readOnly }: { feature: Feature; readOnly: boolean }) {
	const router = useRouter();
	const [status, setStatus] = useState(feature.status);
	const [reason, setReason] = useState(feature.disabledReason ?? "");
	const [saving, setSaving] = useState(false);
	const dirty = status !== feature.status || reason !== (feature.disabledReason ?? "");
	const reasonMissing = status === "disabled" && reason.trim().length < 3;

	if (!feature.implemented) return <NotInCode feature={feature} readOnly={readOnly} />;

	const save = async () => {
		setSaving(true);
		try {
			await api(`/features/${feature.key}`, {
				method: "PATCH",
				body: JSON.stringify({ status, disabledReason: reason }),
			});
			toast.success(`${feature.name} : ${FEATURE_STATUS_LABELS[status].toLowerCase()}`);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<FormCard title="Statut">
			<div className="grid gap-4">
				{feature.description && <p className="text-sm text-muted-foreground">{feature.description}</p>}
				<Field>
					<FieldLabel className="sr-only">Statut</FieldLabel>
					<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Statut">
						{(["active", "beta", "disabled"] as const).map((s) => (
							<button
								key={s}
								type="button"
								role="radio"
								aria-checked={status === s}
								disabled={readOnly}
								onClick={() => setStatus(s)}
								className={cn(
									"flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
									status === s && "bg-background text-foreground shadow-sm",
									status === s && s === "disabled" && "bg-red-600 text-white",
								)}
							>
								{s === "disabled" && <Power className="size-3.5" />}
								{FEATURE_STATUS_LABELS[s]}
							</button>
						))}
					</div>
					<FieldDescription>{HINTS[status]}</FieldDescription>
				</Field>
				{status === "disabled" && (
					<Field data-invalid={reasonMissing}>
						<FieldLabel htmlFor="ft-reason">Motif de la désactivation</FieldLabel>
						<Input
							id="ft-reason"
							disabled={readOnly}
							placeholder="Panne du fournisseur SMS, faille corrigée en cours…"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
						/>
						{reasonMissing && <FieldError errors={[{ message: "Indiquez le motif (3 caractères min.)" }]} />}
					</Field>
				)}
				<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
					<CodeXml className="mt-0.5 size-3.5 shrink-0" />
					Nom, catégorie et description viennent du code (registre <code>@cabinova/features</code>).
				</p>
				{!readOnly && (
					<div className="flex justify-end">
						<Button
							onClick={save}
							disabled={!dirty || saving || reasonMissing}
							variant={status === "disabled" && feature.status !== "disabled" ? "destructive" : "default"}
						>
							{status === "disabled" && feature.status !== "disabled" ? "Désactiver partout" : "Enregistrer"}
						</Button>
					</div>
				)}
			</div>
		</FormCard>
	);
}

/** A feature no code implements: unavailable everywhere; deleting it also clears its plan levels and exceptions. */
function NotInCode({ feature, readOnly }: { feature: Feature; readOnly: boolean }) {
	const router = useRouter();
	const [deleting, setDeleting] = useState(false);

	const remove = async () => {
		setDeleting(true);
		try {
			await api(`/features/${feature.key}`, { method: "DELETE" });
			toast.success(`${feature.name} supprimée`);
			router.push("/features");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Suppression impossible");
			setDeleting(false);
		}
	};

	return (
		<FormCard title="Absente du code">
			<div className="grid gap-3 text-sm">
				<p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
					<CodeXml className="mt-0.5 size-4 shrink-0" />
					Aucun code n’utilise la clé <code>{feature.key}</code> : elle n’est disponible pour aucun cabinet, quelles que
					soient les offres et les exceptions.
				</p>
				<p className="text-muted-foreground">
					Si elle doit exister, un développeur l’ajoute au registre <code>@cabinova/features</code> et écrit son code ;
					elle redevient disponible au déploiement. Sinon, supprimez-la.
				</p>
				{!readOnly && (
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="destructive" size="sm" className="w-fit">
								<Trash2 /> Supprimer
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>Supprimer « {feature.name} » ?</DialogTitle>
								<DialogDescription>
									Son niveau dans chaque offre et ses exceptions par cabinet sont supprimés aussi. La suppression est
									journalisée.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="destructive" onClick={remove} disabled={deleting}>
									Supprimer
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
			</div>
		</FormCard>
	);
}
