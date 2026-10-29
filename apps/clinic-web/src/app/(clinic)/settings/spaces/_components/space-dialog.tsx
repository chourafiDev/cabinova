"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuLoader } from "react-icons/lu";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ManagedSpace } from "@/lib/settings";
import { api } from "@/lib/api-client";

const fromSpace = (s: ManagedSpace | null) => ({
	name: s?.name ?? "",
	city: s?.city ?? "",
	address: s?.address ?? "",
	phone: s?.phone ?? "",
});

/** Create (space = null) or edit a space's name and contact details. */
export function SpaceDialog({
	space,
	open,
	onOpenChange,
}: {
	space: ManagedSpace | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{/* Remounted per opening: the fields start from this space. */}
				{open && <SpaceForm key={space?.id ?? "new"} space={space} onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function SpaceForm({ space, onDone }: { space: ManagedSpace | null; onDone: () => void }) {
	const router = useRouter();
	const [v, setV] = useState(() => fromSpace(space));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (v.name.trim().length < 2) return setError("Nom de l’espace : 2 caractères minimum.");
		setSaving(true);
		setError(null);
		try {
			await api(space ? `/spaces/${space.id}` : "/spaces", {
				method: space ? "PUT" : "POST",
				body: JSON.stringify(v),
			});
			toast.success(
				space ? "Espace enregistré" : `Espace « ${v.name.trim()} » créé`,
				space ? undefined : { description: "Vous y travaillez maintenant : son agenda et ses patients sont vides." },
			);
			onDone();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={save} noValidate className="grid gap-4">
			<DialogHeader>
				<DialogTitle>{space ? "Modifier l’espace" : "Nouvel espace"}</DialogTitle>
				<DialogDescription>
					{space
						? "Nom et coordonnées du site, visibles par son équipe."
						: "Un site du cabinet (ex. une autre ville). Ses patients, son équipe et son agenda sont séparés des autres espaces."}
				</DialogDescription>
			</DialogHeader>
			<FieldGroup className="gap-4">
				<Field data-invalid={!!error}>
					<FieldLabel htmlFor="space-name">Nom</FieldLabel>
					<Input
						id="space-name"
						autoFocus
						maxLength={80}
						placeholder="Ex. Marrakech Guéliz"
						value={v.name}
						aria-invalid={!!error}
						onChange={(e) => setV({ ...v, name: e.target.value })}
					/>
					<FieldError>{error}</FieldError>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="space-city">Ville</FieldLabel>
						<Input id="space-city" maxLength={80} value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
					</Field>
					<Field>
						<FieldLabel htmlFor="space-phone">Téléphone</FieldLabel>
						<Input
							id="space-phone"
							type="tel"
							value={v.phone}
							onChange={(e) => setV({ ...v, phone: e.target.value })}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="space-address">Adresse</FieldLabel>
					<Input
						id="space-address"
						maxLength={300}
						value={v.address}
						onChange={(e) => setV({ ...v, address: e.target.value })}
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Annuler
				</Button>
				<Button type="submit" disabled={saving}>
					{saving && <LuLoader className="animate-spin" />} {space ? "Enregistrer" : "Créer l’espace"}
				</Button>
			</DialogFooter>
		</form>
	);
}
