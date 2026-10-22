"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import {
	ageOf,
	COVERAGE_LABELS,
	type Coverage,
	type Patient,
	type PatientInput,
	patientSchema,
	SEX_LABELS,
	type Sex,
} from "@/lib/patients";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../_components/shared/unsaved-changes-bar";

const FORM_ID = "patient-form";

/** Identity, contact, coverage and emergency contact. Create (no `patientId`) or edit. */
export function PatientForm({
	patientId,
	defaultValues,
	readOnly = false,
}: {
	patientId?: string;
	defaultValues: PatientInput;
	readOnly?: boolean;
}) {
	const router = useRouter();
	const form = useForm<PatientInput>({
		resolver: zodResolver(patientSchema),
		defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const [coverage, birthDate] = useWatch({ control: form.control, name: ["coverage", "birthDate"] });
	const age = birthDate && !errors.birthDate ? ageOf(birthDate) : null;

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const patient = await api<Patient>(patientId ? `/patients/${patientId}` : "/patients", {
				method: patientId ? "PUT" : "POST",
				body: JSON.stringify(values),
			});
			if (patientId) {
				form.reset(values);
				toast.success("Dossier enregistré");
				router.refresh();
			} else {
				toast.success("Patient créé");
				router.push(`/patients/${patient.id}`);
			}
		} catch (err) {
			if (err instanceof ApiError && err.code === "CIN_TAKEN") {
				form.setError("cin", { message: err.message });
				return;
			}
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		}
	});

	const text = (name: keyof PatientInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
		<Field data-invalid={!!errors[name]}>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			<Input id={name} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
			<FieldError errors={[errors[name]]} />
		</Field>
	);

	return (
		<form id={FORM_ID} onSubmit={onSubmit} noValidate>
			<fieldset disabled={readOnly} className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
				<div className="grid gap-3">
					<FormCard title="Identité">
						<FieldGroup className="gap-4">
							<div className="grid gap-4 sm:grid-cols-2">
								{text("lastName", "Nom", { autoComplete: "off", autoFocus: !patientId })}
								{text("firstName", "Prénom", { autoComplete: "off" })}
							</div>
							<div className="grid gap-4 sm:grid-cols-3">
								<Controller
									control={form.control}
									name="sex"
									render={({ field }) => (
										<Field data-invalid={!!errors.sex}>
											<FieldLabel>Sexe</FieldLabel>
											<div role="radiogroup" aria-label="Sexe" className="bg-muted grid h-9 grid-cols-2 rounded-lg p-0.5">
												{(Object.keys(SEX_LABELS) as Sex[]).map((value) => (
													<button
														key={value}
														type="button"
														role="radio"
														aria-checked={field.value === value}
														onClick={() => field.onChange(value)}
														onBlur={field.onBlur}
														className={cn(
															"rounded-md text-sm font-medium transition-colors",
															field.value === value
																? "bg-background shadow-sm"
																: "text-muted-foreground hover:text-foreground",
														)}
													>
														{SEX_LABELS[value]}
													</button>
												))}
											</div>
											<FieldError errors={[errors.sex]} />
										</Field>
									)}
								/>
								<Field data-invalid={!!errors.birthDate}>
									<FieldLabel htmlFor="birthDate">Date de naissance</FieldLabel>
									<Input
										id="birthDate"
										type="date"
										max={new Date().toISOString().slice(0, 10)}
										aria-invalid={!!errors.birthDate}
										{...form.register("birthDate")}
									/>
									{age !== null && <FieldDescription>{age} ans</FieldDescription>}
									<FieldError errors={[errors.birthDate]} />
								</Field>
								{text("cin", "CIN", { placeholder: "BK123456", className: "uppercase" })}
							</div>
						</FieldGroup>
					</FormCard>

					<FormCard title="Coordonnées">
						<FieldGroup className="gap-4">
							<div className="grid gap-4 sm:grid-cols-2">
								{text("phone", "Téléphone", { type: "tel", inputMode: "tel", placeholder: "06 12 34 56 78" })}
								{text("email", "E-mail", { type: "email", placeholder: "Facultatif" })}
							</div>
							<div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
								{text("address", "Adresse")}
								{text("city", "Ville")}
							</div>
						</FieldGroup>
					</FormCard>

					<FormCard title="Note administrative">
						<Field data-invalid={!!errors.notes}>
							<Textarea
								id="notes"
								rows={3}
								placeholder="Informations pratiques (jamais médicales : elles vont dans le dossier médical)."
								aria-invalid={!!errors.notes}
								{...form.register("notes")}
							/>
							<FieldError errors={[errors.notes]} />
						</Field>
					</FormCard>
				</div>

				<div className="grid gap-3">
					<FormCard title="Couverture">
						<FieldGroup className="gap-4">
							<Controller
								control={form.control}
								name="coverage"
								render={({ field }) => (
									<Field>
										<FieldLabel htmlFor="coverage">Régime</FieldLabel>
										<Select value={field.value} onValueChange={(v) => field.onChange(v as Coverage)} disabled={readOnly}>
											<SelectTrigger id="coverage" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(Object.keys(COVERAGE_LABELS) as Coverage[]).map((value) => (
													<SelectItem key={value} value={value}>
														{COVERAGE_LABELS[value]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							/>
							{coverage === "private" && text("insurer", "Assureur", { placeholder: "Ex. Saham, Wafa, AXA…" })}
							{coverage !== "none" && text("coverageNumber", "N° d'immatriculation")}
						</FieldGroup>
					</FormCard>

					<FormCard title="Contact d'urgence">
						<FieldGroup className="gap-4">
							{text("emergencyContactName", "Nom et lien", { placeholder: "Ex. Ahmed (époux)" })}
							{text("emergencyContactPhone", "Téléphone", { type: "tel", inputMode: "tel" })}
						</FieldGroup>
					</FormCard>
				</div>
			</fieldset>

			<UnsavedChangesBar
				visible={isDirty && !readOnly}
				label={patientId ? "Modifications non enregistrées" : "Nouveau patient non enregistré"}
				isSubmitting={isSubmitting}
				onDiscard={() => (patientId ? form.reset() : router.push("/patients"))}
				formId={FORM_ID}
			/>
		</form>
	);
}
