"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuGlobe, LuLoader, LuLock } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import type { CabinetIdentity } from "@/lib/settings";
import { SettingsCard } from "../../_components/settings-card";


const toForm = (c: CabinetIdentity) => ({
	name: c.name,
	legalName: c.legalName ?? "",
	specialty: c.specialty ?? "",
	address: c.address ?? "",
	city: c.city ?? "",
	phone: c.phone ?? "",
	email: c.email,
});
type Form = ReturnType<typeof toForm>;
type Key = keyof Form;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The cabinet's identity, saved in one go. Super Admin sees the same record
 * (changes are logged there as made by the cabinet).
 */
export function CabinetForm({ initial }: { initial: CabinetIdentity }) {
	const router = useRouter();
	const [saved, setSaved] = useState(() => toForm(initial));
	const [v, setV] = useState(saved);
	const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
	const [saving, setSaving] = useState(false);
	const dirty = (Object.keys(v) as Key[]).some((k) => v[k].trim() !== saved[k]);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		const next: Partial<Record<Key, string>> = {};
		if (v.name.trim().length < 2) next.name = "2 caractères minimum.";
		if (!EMAIL.test(v.email.trim())) next.email = "Adresse e-mail invalide.";
		setErrors(next);
		if (Object.keys(next).length) return;

		setSaving(true);
		try {
			const res = await api<CabinetIdentity>("/settings/cabinet", { method: "PUT", body: JSON.stringify(v) });
			const form = toForm(res);
			setSaved(form);
			setV(form);
			toast.success("Informations du cabinet enregistrées");
			router.refresh();
		} catch (err) {
			if (err instanceof ApiError && err.code === "NAME_TAKEN") setErrors({ name: err.message });
			else if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setErrors({ email: err.message });
			else toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	const input = (key: Key, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
		<Field data-invalid={!!errors[key]}>
			<FieldLabel htmlFor={`cabinet-${key}`}>{label}</FieldLabel>
			<Input
				id={`cabinet-${key}`}
				value={v[key]}
				aria-invalid={!!errors[key]}
				onChange={(e) => {
					setV({ ...v, [key]: e.target.value });
					if (errors[key]) setErrors({ ...errors, [key]: undefined });
				}}
				{...props}
			/>
			{errors[key] ? <FieldError>{errors[key]}</FieldError> : hint && <FieldDescription>{hint}</FieldDescription>}
		</Field>
	);

	return (
		<form onSubmit={save} noValidate className="grid gap-4">
			<SettingsCard
				title="Informations du cabinet"
				description="Le nom s’affiche sur la page de connexion, dans l’application et sur les documents."
				footer={
					<>
						<p className="text-muted-foreground text-xs">
							Aussi visibles par l’équipe Cabinova (facturation, support).
						</p>
						<Button type="submit" size="sm" disabled={!dirty || saving}>
							{saving && <LuLoader className="animate-spin" />} Enregistrer
						</Button>
					</>
				}
			>
				<div className="grid gap-6">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="sm:col-span-2">
							{input("name", "Nom du cabinet", { maxLength: 120, placeholder: "Ex. Cabinet Atlas Santé" })}
						</div>
						{input("legalName", "Raison sociale", { maxLength: 160 }, "Si différente du nom (factures).")}
						{input("specialty", "Spécialité", { maxLength: 80, placeholder: "Ex. Médecine générale" })}
					</div>
					<div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
						<p className="text-sm font-medium sm:col-span-2">Coordonnées</p>
						<div className="sm:col-span-2">{input("address", "Adresse", { maxLength: 300 })}</div>
						{input("city", "Ville", { maxLength: 80 })}
						{input("phone", "Téléphone", { type: "tel", maxLength: 30, placeholder: "05 35 00 00 00" })}
						<div className="sm:col-span-2">
							{input(
								"email",
								"E-mail du cabinet",
								{ type: "email", maxLength: 200 },
								"Reçoit les factures et les messages de Cabinova.",
							)}
						</div>
					</div>
				</div>
			</SettingsCard>

			<SettingsCard title="Adresse web" description="L’adresse où votre équipe se connecte.">
				<div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
					<LuGlobe className="text-muted-foreground size-4" />
					<span className="font-mono">{initial.subdomain}.cabinova.ma</span>
					<LuLock className="text-muted-foreground ms-auto size-3.5" aria-label="Non modifiable" />
				</div>
				<p className="text-muted-foreground mt-2 text-xs">Pour la changer, contactez le support Cabinova.</p>
			</SettingsCard>
		</form>
	);
}
