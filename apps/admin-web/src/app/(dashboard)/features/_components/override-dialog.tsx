"use client";

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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { FEATURE_LEVELS, type FeatureLevel } from "@/lib/features";

export type OverrideTarget = {
	featureKey: string;
	featureName: string;
	/** Fixed cabinet (cabinet page); omit to choose one (feature page). */
	tenantId?: string;
	tenantName?: string;
	current?: { level: FeatureLevel; startsAt: string | null; endsAt: string | null; note: string | null } | null;
};

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

/**
 * One cabinet's exception for one feature: a level (give it, give it
 * limited, or withdraw it) with optional start/end dates and a note. For a
 * beta feature, adding a cabinet makes it a tester.
 */
export function OverrideDialog({
	target,
	tenants = [],
	onClose,
}: {
	target: OverrideTarget;
	/** Cabinets to choose from when the target has no tenantId. */
	tenants?: { id: string; name: string }[];
	onClose: () => void;
}) {
	const router = useRouter();
	const [tenantId, setTenantId] = useState(target.tenantId ?? "");
	const [level, setLevel] = useState<FeatureLevel>(target.current?.level ?? "included");
	const [startsAt, setStartsAt] = useState(day(target.current?.startsAt));
	const [endsAt, setEndsAt] = useState(day(target.current?.endsAt));
	const [note, setNote] = useState(target.current?.note ?? "");
	const [saving, setSaving] = useState(false);

	const save = async () => {
		setSaving(true);
		try {
			await api(`/tenants/${tenantId}/features/${target.featureKey}`, {
				method: "PUT",
				body: JSON.stringify({
					level,
					startsAt: startsAt ? new Date(`${startsAt}T00:00`).toISOString() : null,
					endsAt: endsAt ? new Date(`${endsAt}T00:00`).toISOString() : null,
					note: note || null,
				}),
			});
			toast.success("Exception enregistrée");
			onClose();
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Exception — {target.featureName}</DialogTitle>
					<DialogDescription>
						{target.tenantName
							? `Pour ${target.tenantName} uniquement, à la place de ce que prévoit son offre.`
							: "Pour un cabinet uniquement, à la place de ce que prévoit son offre."}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					{!target.tenantId && (
						<Field>
							<FieldLabel htmlFor="ov-tenant">Cabinet</FieldLabel>
							<Select value={tenantId} onValueChange={setTenantId}>
								<SelectTrigger id="ov-tenant" className="w-full">
									<SelectValue placeholder="Choisir un cabinet" />
								</SelectTrigger>
								<SelectContent>
									{tenants.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
					<Field>
						<FieldLabel htmlFor="ov-level">Niveau</FieldLabel>
						<Select value={level} onValueChange={(v) => setLevel(v as FeatureLevel)}>
							<SelectTrigger id="ov-level" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(FEATURE_LEVELS) as FeatureLevel[]).map((l) => (
									<SelectItem key={l} value={l}>
										{l === "none" ? "Non inclus (retirer)" : FEATURE_LEVELS[l]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="ov-start">Accès à partir du</FieldLabel>
							<Input id="ov-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="ov-end">Jusqu’au (exclu)</FieldLabel>
							<Input id="ov-end" type="date" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} />
						</Field>
					</div>
					<FieldDescription className="-mt-2">Dates vides : immédiatement et sans fin.</FieldDescription>
					<Field>
						<FieldLabel htmlFor="ov-note">Note</FieldLabel>
						<Input id="ov-note" placeholder="Geste commercial, testeur bêta, option achetée…" value={note} onChange={(e) => setNote(e.target.value)} />
					</Field>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Annuler
					</Button>
					<Button onClick={save} disabled={saving || !tenantId}>
						Enregistrer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
