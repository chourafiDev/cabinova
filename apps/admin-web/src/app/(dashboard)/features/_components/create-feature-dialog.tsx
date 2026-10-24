"use client";

import { Plus } from "lucide-react";
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
import { ApiError, api } from "@/lib/api-client";

const slug = (v: string) =>
	v
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 60);

/**
 * Declares a new feature. It starts in beta: nobody gets it until cabinets
 * are added as testers, then it's opened to plans.
 */
export function CreateFeatureDialog() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [key, setKey] = useState("");
	const [keyTouched, setKeyTouched] = useState(false);
	const [category, setCategory] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const reset = () => {
		setName("");
		setKey("");
		setKeyTouched(false);
		setCategory("");
		setDescription("");
		setError(null);
	};

	const save = async () => {
		setError(null);
		try {
			await api("/features", {
				method: "POST",
				body: JSON.stringify({ key, name, category, description, status: "beta" }),
			});
			toast.success(`« ${name} » créée en bêta`);
			setOpen(false);
			reset();
			router.push(`/features/${key}`);
		} catch (err) {
			setError(err instanceof ApiError || err instanceof Error ? err.message : "Création impossible");
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button>
					<Plus /> Nouvelle fonctionnalité
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Nouvelle fonctionnalité</DialogTitle>
					<DialogDescription>
						Créée en bêta : réservée aux cabinets testeurs que vous ajoutez, puis ouverte aux offres.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<Field>
						<FieldLabel htmlFor="nf-name">Nom</FieldLabel>
						<Input
							id="nf-name"
							autoFocus
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (!keyTouched) setKey(slug(e.target.value));
							}}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="nf-key">Identifiant</FieldLabel>
						<Input
							id="nf-key"
							className="font-mono"
							value={key}
							onChange={(e) => {
								setKeyTouched(true);
								setKey(e.target.value);
							}}
						/>
						<FieldDescription>Utilisé par l’application des cabinets ; non modifiable ensuite.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="nf-cat">Catégorie</FieldLabel>
						<Input id="nf-cat" placeholder="Agenda, Communication…" value={category} onChange={(e) => setCategory(e.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor="nf-desc">Description</FieldLabel>
						<Input id="nf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
					</Field>
					{error && <FieldError errors={[{ message: error }]} />}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Annuler
					</Button>
					<Button onClick={save} disabled={name.trim().length < 2 || !key}>
						Créer en bêta
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
