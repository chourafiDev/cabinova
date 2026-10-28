"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ContactRound, Loader, MapPin, Phone, Plus, ShieldCheck, StickyNote } from "lucide-react";
import { useState } from "react";
import { Controller, type FieldErrors, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useModifierLabel } from "@/components/keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

/** "Today" for the birth date picker (outside render: React Compiler purity). */
const today = () => new Date().toISOString().slice(0, 10);

/** The optional groups, folded until needed. */
const OPTIONAL = {
	address: ["address", "city", "email"],
	coverage: ["coverage", "coverageNumber", "insurer"],
	emergency: ["emergencyContactName", "emergencyContactPhone"],
	notes: ["notes"],
} as const satisfies Record<string, readonly (keyof PatientInput)[]>;
type Group = keyof typeof OPTIONAL;

const hasValue = (values: PatientInput, group: Group) =>
	OPTIONAL[group].some((k) => (k === "coverage" ? values.coverage !== "none" : Boolean(values[k])));
const hasError = (errors: FieldErrors<PatientInput>, group: Group) => OPTIONAL[group].some((k) => errors[k]);

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
	return (
		<FieldLabel htmlFor={htmlFor}>
			{children}
			{required && <span className="text-primary">*</span>}
		</FieldLabel>
	);
}

/** A folded group of optional fields: a one-line summary until opened. */
function OptionalSection({
	icon: Icon,
	title,
	summary,
	open,
	onToggle,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	summary?: string;
	open: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("rounded-xl border transition-colors", open && "bg-muted/30")}>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className="flex w-full items-center gap-3 px-4 py-3 text-start"
			>
				<span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
					<Icon className="size-4" />
				</span>
				<span className="grid min-w-0 flex-1">
					<span className="text-sm font-medium">{title}</span>
					{!open && <span className="text-muted-foreground truncate text-xs">{summary ?? "Facultatif"}</span>}
				</span>
				{open ? (
					<ChevronDown className="text-muted-foreground size-4 rotate-180 transition-transform" />
				) : summary ? (
					<ChevronDown className="text-muted-foreground size-4 transition-transform" />
				) : (
					<Plus className="text-muted-foreground size-4" />
				)}
			</button>
			{open && <div className="grid gap-4 px-4 pb-4">{children}</div>}
		</section>
	);
}

/**
 * The patient form in the sheet. What the front desk needs at check-in
 * comes first; address, coverage, emergency contact and note stay folded
 * until needed (opened when they hold data or an error). New patient:
 * "Créer et prendre RDV" goes straight to booking.
 */
export function PatientForm({
	patientId,
	defaultValues,
	onSaved,
	onCancel,
}: {
	patientId?: string;
	defaultValues: PatientInput;
	onSaved: (patient: Patient, next: "file" | "book") => void;
	onCancel: () => void;
}) {
	const form = useForm<PatientInput>({
		resolver: zodResolver(patientSchema),
		defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const modifier = useModifierLabel();
	const values = useWatch({ control: form.control }) as PatientInput;
	const age = values.birthDate && !errors.birthDate ? ageOf(values.birthDate) : null;
	const [opened, setOpened] = useState<Record<Group, boolean>>(() => ({
		address: hasValue(defaultValues, "address"),
		coverage: hasValue(defaultValues, "coverage"),
		emergency: hasValue(defaultValues, "emergency"),
		notes: hasValue(defaultValues, "notes"),
	}));
	const isOpen = (g: Group) => opened[g] || hasError(errors, g);
	const toggle = (g: Group) => setOpened((o) => ({ ...o, [g]: !isOpen(g) }));

	const submit = (next: "file" | "book") =>
		form.handleSubmit(async (input) => {
			try {
				const patient = await api<Patient>(patientId ? `/patients/${patientId}` : "/patients", {
					method: patientId ? "PUT" : "POST",
					body: JSON.stringify(input),
				});
				toast.success(patientId ? "Dossier enregistré" : `Dossier n° ${patient.fileNumber} créé`);
				onSaved(patient, next);
			} catch (err) {
				if (err instanceof ApiError && err.code === "CIN_TAKEN") {
					form.setError("cin", { message: err.message });
					return;
				}
				toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
			}
		});

	const input = (
		name: keyof PatientInput,
		label: string,
		props: React.ComponentProps<typeof Input> & { required?: boolean } = {},
	) => {
		const { required, ...rest } = props;
		return (
			<Field data-invalid={!!errors[name]}>
				<Label htmlFor={name} required={required}>
					{label}
				</Label>
				<Input id={name} aria-invalid={!!errors[name]} {...rest} {...form.register(name)} />
				<FieldError errors={[errors[name]]} />
			</Field>
		);
	};

	const coverageSummary =
		values.coverage && values.coverage !== "none"
			? [COVERAGE_LABELS[values.coverage], values.insurer, values.coverageNumber].filter(Boolean).join(" · ")
			: undefined;

	return (
		<form
			onSubmit={submit("file")}
			onKeyDown={(e) => {
				// ⌘↵ / Ctrl+↵ saves from any field.
				if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					void submit("file")();
				}
			}}
			noValidate
			className="flex min-h-0 flex-1 flex-col"
		>
			<div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-5">
				<section className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						{input("lastName", "Nom", { required: true, autoComplete: "off", autoFocus: !patientId })}
						{input("firstName", "Prénom", { required: true, autoComplete: "off" })}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Controller
							control={form.control}
							name="sex"
							render={({ field }) => (
								<Field data-invalid={!!errors.sex}>
									<Label required>Sexe</Label>
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
													field.value === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
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
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="birthDate">Date de naissance</Label>
								{age !== null && (
									<span className="bg-muted text-muted-foreground rounded-full px-2 text-xs tabular-nums">{age} ans</span>
								)}
							</div>
							<Input
								id="birthDate"
								type="date"
								max={today()}
								aria-invalid={!!errors.birthDate}
								{...form.register("birthDate")}
							/>
							<FieldError errors={[errors.birthDate]} />
						</Field>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!errors.phone}>
							<Label htmlFor="phone">Téléphone</Label>
							<div className="relative">
								<Phone className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
								<Input
									id="phone"
									type="tel"
									inputMode="tel"
									placeholder="06 12 34 56 78"
									className="ps-9"
									aria-invalid={!!errors.phone}
									{...form.register("phone")}
								/>
							</div>
							<FieldError errors={[errors.phone]} />
						</Field>
						{input("cin", "CIN", { placeholder: "BK123456", className: "uppercase" })}
					</div>
				</section>

				<div className="grid gap-2">
					<p className="text-muted-foreground text-xs font-medium">Informations complémentaires</p>

					<OptionalSection
						icon={MapPin}
						title="Adresse et e-mail"
						summary={[values.address, values.city, values.email].filter(Boolean).join(" · ") || undefined}
						open={isOpen("address")}
						onToggle={() => toggle("address")}
					>
						<div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
							{input("address", "Adresse")}
							{input("city", "Ville")}
						</div>
						{input("email", "E-mail", { type: "email", placeholder: "nom@exemple.ma" })}
					</OptionalSection>

					<OptionalSection
						icon={ShieldCheck}
						title="Couverture médicale"
						summary={coverageSummary}
						open={isOpen("coverage")}
						onToggle={() => toggle("coverage")}
					>
						<Controller
							control={form.control}
							name="coverage"
							render={({ field }) => (
								<Field>
									<Label>Régime</Label>
									<div role="radiogroup" aria-label="Régime" className="flex flex-wrap gap-1.5">
										{(Object.keys(COVERAGE_LABELS) as Coverage[]).map((value) => (
											<button
												key={value}
												type="button"
												role="radio"
												aria-checked={field.value === value}
												onClick={() => field.onChange(value)}
												className={cn(
													"h-8 rounded-lg border px-3 text-sm transition-colors",
													field.value === value
														? "border-primary bg-primary text-primary-foreground font-medium"
														: "bg-background text-muted-foreground hover:text-foreground",
												)}
											>
												{COVERAGE_LABELS[value]}
											</button>
										))}
									</div>
								</Field>
							)}
						/>
						{values.coverage !== "none" && (
							<div className="grid gap-4 sm:grid-cols-2">
								{values.coverage === "private" &&
									input("insurer", "Assureur", { placeholder: "Saham, Wafa, AXA…" })}
								{input("coverageNumber", "N° d’immatriculation")}
							</div>
						)}
					</OptionalSection>

					<OptionalSection
						icon={ContactRound}
						title="Contact d’urgence"
						summary={[values.emergencyContactName, values.emergencyContactPhone].filter(Boolean).join(" · ") || undefined}
						open={isOpen("emergency")}
						onToggle={() => toggle("emergency")}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							{input("emergencyContactName", "Nom et lien", { placeholder: "Ahmed (époux)" })}
							{input("emergencyContactPhone", "Téléphone", { type: "tel", inputMode: "tel" })}
						</div>
					</OptionalSection>

					<OptionalSection
						icon={StickyNote}
						title="Note administrative"
						summary={values.notes || undefined}
						open={isOpen("notes")}
						onToggle={() => toggle("notes")}
					>
						<Field data-invalid={!!errors.notes}>
							<Textarea
								id="notes"
								rows={3}
								placeholder="Informations pratiques pour l’accueil. Jamais médicales : elles vont dans les antécédents."
								aria-invalid={!!errors.notes}
								{...form.register("notes")}
							/>
							<FieldError errors={[errors.notes]} />
						</Field>
					</OptionalSection>
				</div>
			</div>

			<div className="flex items-center gap-2 border-t px-5 py-3">
				<p className="text-muted-foreground me-auto hidden text-xs sm:block">
					<span className="text-primary">*</span> obligatoire ·{" "}
					<kbd className="font-mono">{modifier}+↵</kbd> pour enregistrer
				</p>
				<Button type="button" variant="ghost" onClick={onCancel}>
					Annuler
				</Button>
				{patientId ? (
					<Button type="submit" disabled={isSubmitting || !isDirty}>
						{isSubmitting && <Loader className="animate-spin" />}
						Enregistrer
					</Button>
				) : (
					<>
						<Button type="button" variant="outline" disabled={isSubmitting} onClick={submit("book")}>
							Créer et prendre RDV
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader className="animate-spin" />}
							Créer le dossier
						</Button>
					</>
				)}
			</div>
		</form>
	);
}
