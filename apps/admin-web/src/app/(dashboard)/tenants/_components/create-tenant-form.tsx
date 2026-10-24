"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, Check, CreditCard, Globe, Loader, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { ApiError, api } from "@/lib/api-client";
import { annualDiscount, type BillingPeriod, formatLimit, formatPrice, formatStorage, type Plan } from "@/lib/plans";
import { type CreateTenantInput, createTenantSchema, toCreateTenantBody, toStorageGb } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { FormSection } from "../../_components/shared/form-section";

const DOMAIN = "cabinova.ma";

/** "Clinique Al Amal — Rabat" → "clinique-al-amal-rabat" */
const slugify = (v: string) =>
	v
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);

const planValues = (plan: Plan) => ({
	planKey: plan.key,
	trialDays: String(plan.trialDays),
	maxDoctors: plan.maxDoctors?.toString() ?? "",
	maxSecretaries: plan.maxSecretaries?.toString() ?? "",
	maxUsers: plan.maxUsers?.toString() ?? "",
	storageQuotaGb: toStorageGb(plan.storageQuotaMb),
});


/**
 * Module 2, Scenario A — add a cabinet. Four short sections, the plan as
 * cards, quotas folded behind "Personnaliser" (they follow the plan), and a
 * live summary that holds the submit button.
 */
export function CreateTenantForm({ plans, defaultValues }: { plans: Plan[]; defaultValues: CreateTenantInput }) {
	const router = useRouter();
	const initialPlan = plans.find((p) => p.key === "pro") ?? plans[0];
	const form = useForm<CreateTenantInput>({
		resolver: zodResolver(createTenantSchema),
		defaultValues: initialPlan ? { ...defaultValues, ...planValues(initialPlan) } : defaultValues,
		mode: "onTouched",
	});
	const { errors, isSubmitting } = form.formState;
	const values = useWatch({ control: form.control });
	const [subdomainTouched, setSubdomainTouched] = useState(false);
	const [customQuotas, setCustomQuotas] = useState(false);
	const plan = plans.find((p) => p.key === values.planKey);
	const period = (values.billingPeriod ?? "monthly") as BillingPeriod;
	const trialDays = Number(values.trialDays) || 0;
	const price = plan ? (period === "annual" ? plan.priceAnnual : plan.priceMonthly) : 0;

	const set = (name: FieldPath<CreateTenantInput>, value: string) =>
		form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

	const pickPlan = (picked: Plan) => {
		for (const [name, value] of Object.entries(planValues(picked))) set(name as FieldPath<CreateTenantInput>, value);
		setCustomQuotas(false);
	};

	const onSubmit = form.handleSubmit(
		async (v) => {
			try {
				const tenant = await api<{ id: string }>("/tenants", {
					method: "POST",
					body: JSON.stringify(toCreateTenantBody(v)),
				});
				toast.success(`${v.name} est créé`, { description: "Provisionnez sa base depuis l’onglet Technique." });
				router.push(`/tenants/${tenant.id}`);
			} catch (err) {
				const field = { EMAIL_TAKEN: "email", NAME_TAKEN: "name", SUBDOMAIN_TAKEN: "subdomain" }[
					(err as ApiError).code ?? ""
				] as FieldPath<CreateTenantInput> | undefined;
				if (err instanceof ApiError && field) {
					form.setError(field, { message: err.message }, { shouldFocus: true });
					return;
				}
				toast.error(err instanceof Error ? err.message : "Création impossible");
			}
		},
		() => toast.error("Vérifiez les champs signalés."),
	);

	const text = (
		name: FieldPath<CreateTenantInput>,
		label: string,
		props: React.ComponentProps<typeof Input> = {},
		hint?: string,
	) => (
		<Field data-invalid={!!errors[name as keyof typeof errors]}>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			<Input id={name} aria-invalid={!!errors[name as keyof typeof errors]} {...props} {...form.register(name)} />
			{hint && <FieldDescription>{hint}</FieldDescription>}
			<FieldError errors={[errors[name as keyof typeof errors]]} />
		</Field>
	);

	const nameField = form.register("name");

	return (
		<form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
			<div className="grid gap-4">
				<FormSection step={1} icon={Building2} title="Le cabinet" description="Comment il apparaîtra dans Cabinova et sur ses factures.">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!errors.name}>
							<FieldLabel htmlFor="name">Nom du cabinet</FieldLabel>
							<Input
								id="name"
								autoFocus
								placeholder="Clinique Al Amal"
								aria-invalid={!!errors.name}
								{...nameField}
								onChange={(e) => {
									void nameField.onChange(e);
									if (!subdomainTouched) set("subdomain", slugify(e.target.value));
								}}
							/>
							<FieldError errors={[errors.name]} />
						</Field>
						{text("legalName", "Raison sociale", { placeholder: "Facultatif" })}
					</div>
					{text("specialty", "Spécialité", { placeholder: "Cardiologie, pédiatrie…" })}
				</FormSection>

				<FormSection
					step={2}
					icon={UserRound}
					title="Responsable et coordonnées"
					description="Le médecin responsable reçoit l’invitation à son adresse e-mail."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						{text("responsibleName", "Médecin responsable", { placeholder: "Dr. Amine Tazi" })}
						{text("email", "E-mail", { type: "email", placeholder: "contact@cabinet.ma" }, "Identifiant unique du cabinet.")}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						{text("phone", "Téléphone", { type: "tel", placeholder: "05 22 00 00 00" })}
						{text("city", "Ville", { placeholder: "Rabat" })}
					</div>
					{text("address", "Adresse", { placeholder: "Facultatif" })}
				</FormSection>

				<FormSection step={3} icon={Globe} title="Adresse web" description="Le cabinet se connectera à son propre sous-domaine.">
					<Field data-invalid={!!errors.subdomain}>
						<FieldLabel htmlFor="subdomain">Sous-domaine</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<Globe />
							</InputGroupAddon>
							<InputGroupInput
								id="subdomain"
								placeholder="clinique-al-amal"
								aria-invalid={!!errors.subdomain}
								{...form.register("subdomain", { onChange: () => setSubdomainTouched(true) })}
							/>
							<InputGroupAddon align="inline-end">
								<InputGroupText>.{DOMAIN}</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
						<FieldDescription>
							{subdomainTouched ? "Minuscules, chiffres et tirets." : "Proposé à partir du nom ; modifiable."}
						</FieldDescription>
						<FieldError errors={[errors.subdomain]} />
					</Field>
				</FormSection>

				<FormSection
					step={4}
					icon={CreditCard}
					title="Offre"
					description="L’offre fixe l’essai et les quotas ; la facturation commence à la fin de l’essai."
					action={
						<div className="flex shrink-0 rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Facturation">
							{(["monthly", "annual"] as const).map((p) => (
								<button
									key={p}
									type="button"
									role="radio"
									aria-checked={period === p}
									onClick={() => set("billingPeriod", p)}
									className={cn(
										"rounded-md px-2.5 py-1 text-muted-foreground transition-colors",
										period === p && "bg-background text-foreground shadow-sm",
									)}
								>
									{p === "monthly" ? "Mensuel" : "Annuel"}
								</button>
							))}
						</div>
					}
				>
					{plans.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Aucune offre active.{" "}
							<Link href="/plans" className="underline">
								Créez-en une dans Offres
							</Link>
							.
						</p>
					) : (
						<div className="@container">
							{/* Side by side only when the section is wide enough (container query, not viewport). */}
						<div role="radiogroup" aria-label="Offre" className="grid gap-3 @xl:grid-cols-3">
							{plans.map((p) => {
								const selected = p.key === values.planKey;
								const discount = annualDiscount(p);
								return (
									<button
										key={p.key}
										type="button"
										role="radio"
										aria-checked={selected}
										onClick={() => pickPlan(p)}
										className={cn(
											"relative grid min-w-0 content-start gap-2 rounded-xl border p-3.5 text-start transition-colors hover:border-foreground/30",
											selected && "border-primary bg-primary/5 ring-1 ring-primary hover:border-primary",
										)}
									>
										{selected && (
											<span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
												<Check className="size-3" />
											</span>
										)}
										<span className="pe-6 font-semibold">{p.name}</span>
										<span className="grid tabular-nums leading-tight">
											<span className="whitespace-nowrap text-lg font-semibold">
												{formatPrice(period === "annual" ? p.priceAnnual : p.priceMonthly)}
											</span>
											<span className="text-xs text-muted-foreground">par {period === "annual" ? "an" : "mois"}</span>
										</span>
										{period === "annual" && discount > 0 && (
											<span className="w-fit rounded-full bg-emerald-50 px-1.5 text-xs text-emerald-700">−{discount} %</span>
										)}
										{p.description && <span className="text-xs text-muted-foreground">{p.description}</span>}
										<ul className="mt-1 grid gap-0.5 border-t pt-2 text-xs text-muted-foreground">
											<li>{formatLimit(p.maxDoctors)} médecin(s)</li>
											<li>{formatLimit(p.maxUsers)} utilisateur(s)</li>
											<li>{formatStorage(p.storageQuotaMb)} de stockage</li>
											<li>{p.trialDays ? `${p.trialDays} jours d’essai` : "Sans essai"}</li>
										</ul>
									</button>
								);
							})}
						</div>
						</div>
					)}
					<FieldError errors={[errors.planKey]} />

					<div className="grid gap-3 rounded-lg bg-muted/50 p-3">
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
							<span className="text-muted-foreground">
								{customQuotas ? "Quotas personnalisés pour ce cabinet" : "Essai et quotas de l’offre"}
							</span>
							<Button type="button" size="sm" variant="ghost" onClick={() => setCustomQuotas((c) => !c)}>
								<SlidersHorizontal /> {customQuotas ? "Masquer" : "Personnaliser"}
							</Button>
						</div>
						{customQuotas ? (
							<div className="grid gap-4 sm:grid-cols-5">
								{text("trialDays", "Essai (jours)", { inputMode: "numeric" })}
								{text("maxDoctors", "Médecins", { inputMode: "numeric", placeholder: "Illimité" })}
								{text("maxSecretaries", "Secrétaires", { inputMode: "numeric", placeholder: "Illimité" })}
								{text("maxUsers", "Utilisateurs", { inputMode: "numeric", placeholder: "Illimité" })}
								{text("storageQuotaGb", "Stockage (Go)", { inputMode: "numeric", placeholder: "Illimité" })}
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								{trialDays ? `${trialDays} jours d’essai` : "Sans essai"} · {values.maxDoctors || "∞"} médecin(s) ·{" "}
								{values.maxSecretaries || "∞"} secrétaire(s) · {values.maxUsers || "∞"} utilisateur(s) ·{" "}
								{values.storageQuotaGb ? `${values.storageQuotaGb} Go` : "stockage illimité"}
							</p>
						)}
					</div>
				</FormSection>
			</div>

			<aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-4">
				<h2 className="mb-4 font-semibold">Récapitulatif</h2>
				<dl className="grid gap-3 text-sm">
					<div className="grid gap-0.5">
						<dt className="text-xs text-muted-foreground">Cabinet</dt>
						<dd className="truncate font-medium">{values.name || "—"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-xs text-muted-foreground">Adresse web</dt>
						<dd className="truncate font-mono text-xs">
							{values.subdomain ? `${values.subdomain}.${DOMAIN}` : "—"}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-xs text-muted-foreground">Offre</dt>
						<dd className="font-medium">
							{plan ? `${plan.name} · ${period === "annual" ? "annuel" : "mensuel"}` : "—"}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-xs text-muted-foreground">Essai gratuit</dt>
						<dd>
							{trialDays
								? `${trialDays} jours, jusqu’au ${format(addDays(new Date(), trialDays), "d MMMM yyyy", { locale: fr })}`
								: "Aucun — facturé dès l’activation"}
						</dd>
					</div>
				</dl>
				<div className="my-4 flex items-baseline justify-between border-y py-3">
					<span className="text-sm text-muted-foreground">Ensuite</span>
					<span className="tabular-nums">
						<span className="text-lg font-semibold">{plan ? formatPrice(price) : "—"}</span>
						<span className="text-xs text-muted-foreground"> / {period === "annual" ? "an" : "mois"}</span>
					</span>
				</div>
				<Button type="submit" className="w-full" disabled={isSubmitting || !plans.length}>
					{isSubmitting && <Loader className="animate-spin" />} Créer le cabinet
				</Button>
				<Button asChild variant="ghost" className="mt-2 w-full">
					<Link href="/tenants">Annuler</Link>
				</Button>
				<p className="mt-3 text-xs text-muted-foreground">
					Le cabinet est créé « En attente ». Sa base de données se provisionne ensuite depuis l’onglet Technique.
				</p>
			</aside>
		</form>
	);
}
