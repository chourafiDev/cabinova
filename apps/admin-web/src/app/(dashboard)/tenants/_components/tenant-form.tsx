"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { toUpdateTenantBody, type UpdateTenantInput, updateTenantSchema } from "@/lib/tenants";
import { FormCard } from "../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../_components/shared/unsaved-changes-bar";

const FORM_ID = "tenant-form";

/**
 * Module 2, Scenario B — edit a cabinet's administrative details and quotas.
 * The subdomain, plan and trial are set at creation (CreateTenantForm); the
 * plan then changes from the Abonnement tab.
 */
export function TenantForm({ tenantId, defaultValues }: { tenantId: string; defaultValues: UpdateTenantInput }) {
	const router = useRouter();
	const form = useForm<UpdateTenantInput>({
		resolver: zodResolver(updateTenantSchema),
		defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const backHref = `/tenants/${tenantId}`;

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await api(`/tenants/${tenantId}`, {
				method: "PATCH",
				body: JSON.stringify(toUpdateTenantBody(values)),
			});
			toast.success("Cabinet mis à jour");
			router.push(backHref);
			router.refresh();
		} catch (err) {
			const field = { EMAIL_TAKEN: "email", NAME_TAKEN: "name" }[(err as ApiError).code ?? ""] as
				| "email"
				| "name"
				| undefined;
			if (err instanceof ApiError && field) {
				form.setError(field, { message: err.message });
				return;
			}
			toast.error(err instanceof Error ? err.message : "Modification impossible");
		}
	});

	const text = (name: keyof UpdateTenantInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
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

			<FormCard title="Quotas">
				<FieldGroup className="gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						{text("maxDoctors", "Médecins max.", { inputMode: "numeric", placeholder: "Illimité" })}
						{text("maxSecretaries", "Secrétaires max.", { inputMode: "numeric", placeholder: "Illimité" })}
						{text("maxUsers", "Utilisateurs max.", { inputMode: "numeric", placeholder: "Illimité" })}
						{text("storageQuotaGb", "Stockage (Go)", { inputMode: "numeric", placeholder: "Illimité" })}
					</div>
					<FieldDescription>Vide = illimité.</FieldDescription>
				</FieldGroup>
			</FormCard>

			<UnsavedChangesBar
				visible={isDirty && !isSubmitting}
				label="Modifications non enregistrées"
				isSubmitting={isSubmitting}
				onDiscard={() => router.push(backHref)}
				formId={FORM_ID}
			/>
		</form>
	);
}
