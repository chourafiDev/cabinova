"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { type CreateTenantInput, createTenantSchema, toCreateTenantBody } from "@/lib/tenants";
import { FormCard } from "../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../_components/shared/unsaved-changes-bar";

const FORM_ID = "tenant-form";

/** Module 2, Scenario A — create a cabinet. Read-only edit comes with the detail page's own module. */
export function TenantForm({ defaultValues }: { defaultValues: CreateTenantInput }) {
	const router = useRouter();
	const form = useForm<CreateTenantInput>({
		resolver: zodResolver(createTenantSchema),
		defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const subdomain = useWatch({ control: form.control, name: "subdomain" });

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const tenant = await api<{ id: string }>("/tenants", {
				method: "POST",
				body: JSON.stringify(toCreateTenantBody(values)),
			});
			toast.success("Cabinet créé");
			router.push(`/tenants/${tenant.id}`);
		} catch (err) {
			if (err instanceof ApiError && err.code === "EMAIL_TAKEN") {
				form.setError("email", { message: err.message });
				return;
			}
			if (err instanceof ApiError && err.code === "NAME_TAKEN") {
				form.setError("name", { message: err.message });
				return;
			}
			if (err instanceof ApiError && err.code === "SUBDOMAIN_TAKEN") {
				form.setError("subdomain", { message: err.message });
				return;
			}
			toast.error(err instanceof Error ? err.message : "Création impossible");
		}
	});

	const text = (
		name: keyof CreateTenantInput,
		label: string,
		props: React.ComponentProps<typeof Input> = {},
	) => (
		<Field data-invalid={!!errors[name]}>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			<Input id={name} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
			<FieldError errors={[errors[name]]} />
		</Field>
	);

	return (
		<form id={FORM_ID} onSubmit={onSubmit} noValidate className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
			<div className="grid gap-3">
				<FormCard title="Informations">
					<FieldGroup className="gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							{text("name", "Nom du cabinet", { autoFocus: true })}
							{text("legalName", "Raison sociale")}
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							{text("responsibleName", "Médecin responsable")}
							{text("specialty", "Spécialité")}
						</div>
					</FieldGroup>
				</FormCard>

				<FormCard title="Coordonnées">
					<FieldGroup className="gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							{text("email", "E-mail", { type: "email" })}
							{text("phone", "Téléphone", { type: "tel" })}
						</div>
						<div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
							{text("address", "Adresse")}
							{text("city", "Ville")}
						</div>
					</FieldGroup>
				</FormCard>
			</div>

			<div className="grid gap-3">
				<FormCard title="Domaine">
					<Field data-invalid={!!errors.subdomain}>
						<FieldLabel htmlFor="subdomain">Sous-domaine</FieldLabel>
						<Input
							id="subdomain"
							aria-invalid={!!errors.subdomain}
							placeholder="clinique-rabat"
							{...form.register("subdomain")}
						/>
						<FieldDescription>{`${subdomain || "…"}.cabinova.ma`}</FieldDescription>
						<FieldError errors={[errors.subdomain]} />
					</Field>
				</FormCard>

				<FormCard title="Essai et limites">
					<FieldGroup className="gap-4">
						{text("trialDays", "Durée d'essai (jours)", { inputMode: "numeric" })}
						<div className="grid gap-4 sm:grid-cols-2">
							{text("maxDoctors", "Médecins max.", { inputMode: "numeric", placeholder: "Illimité" })}
							{text("maxUsers", "Utilisateurs max.", { inputMode: "numeric", placeholder: "Illimité" })}
						</div>
					</FieldGroup>
				</FormCard>
			</div>

			<UnsavedChangesBar
				visible={isDirty && !isSubmitting}
				label="Nouveau cabinet non enregistré"
				isSubmitting={isSubmitting}
				onDiscard={() => router.push("/tenants")}
				formId={FORM_ID}
			/>
		</form>
	);
}
