"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Gauge, Hash, Layers, Loader, Plus, Settings2, Tag, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api-client";
import type { Feature } from "@/lib/features";
import {
	EMPTY_PLAN,
	type FeatureLevel,
	formatPrice,
	type Plan,
	type PlanInput,
	planSchema,
	toPlanBody,
	toPlanInput,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import { FormSection } from "../../_components/shared/form-section";

/** Short labels for the per-feature level switch, in display order. */
const LEVELS: { value: FeatureLevel; label: string; tone: string }[] = [
	{ value: "included", label: "Inclus", tone: "bg-emerald-600 text-white" },
	{ value: "limited", label: "Limité", tone: "bg-amber-500 text-white" },
	{ value: "addon", label: "Option", tone: "bg-sky-600 text-white" },
	{ value: "custom", label: "Sur mesure", tone: "bg-violet-600 text-white" },
	{ value: "none", label: "Non", tone: "bg-zinc-700 text-white" },
];

const toCentimes = (v: string | undefined) => Math.round(Number((v ?? "").replace(",", ".")) * 100) || 0;

/** "Pro Plus" → "pro_plus" (plan identifiers use underscores). */
const toKey = (v: string) =>
	v
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 40);


/**
 * Module 3 — create or edit a plan: identity, prices and trial, limits, the
 * level of each catalog feature. The side panel previews the plan card as
 * shown when adding a cabinet, and holds availability and the save button.
 */
export function PlanForm(
	props: ({ mode: "create"; defaultValues: PlanInput } | { mode: "edit"; planId: string; defaultValues: PlanInput }) & {
		/** The feature catalog (GET /features), in display order. */
		catalog: Feature[];
		/** Create only: existing plans to start from. */
		templates?: Plan[];
	},
) {
	const router = useRouter();
	const editing = props.mode === "edit";
	const form = useForm<PlanInput>({
		resolver: zodResolver(planSchema),
		defaultValues: props.defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const v = useWatch({ control: form.control });
	const [keyTouched, setKeyTouched] = useState(editing);
	const [template, setTemplate] = useState<string | null>(null);

	/** Create: copy prices, trial, limits and features from an existing plan (name and key stay yours). */
	const startFrom = (plan: Plan | null) => {
		const { name, key, description } = form.getValues();
		const base = plan ? toPlanInput(plan) : EMPTY_PLAN;
		form.reset({ ...base, name, key, description, active: true }, { keepDefaultValues: true });
		setTemplate(plan?.key ?? null);
	};
	const monthly = toCentimes(v.priceMonthly);
	const annual = toCentimes(v.priceAnnual);
	const discount = monthly && annual ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
	const levelOf = (key: string): FeatureLevel => (v.features?.[key] as FeatureLevel | undefined) ?? "none";

	const onSubmit = form.handleSubmit(
		async (values) => {
			try {
				const body = JSON.stringify(toPlanBody(values, props.mode));
				if (editing) {
					await api(`/plans/${props.planId}`, { method: "PATCH", body });
					toast.success("Offre mise à jour");
				} else {
					await api("/plans", { method: "POST", body });
					toast.success("Offre créée");
				}
				router.push("/plans");
				router.refresh();
			} catch (err) {
				if (err instanceof ApiError && err.code === "PLAN_KEY_TAKEN") {
					form.setError("key", { message: err.message }, { shouldFocus: true });
					return;
				}
				toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
			}
		},
		() => toast.error("Vérifiez les champs signalés."),
	);

	const text = (
		name: FieldPath<PlanInput>,
		label: string,
		props: React.ComponentProps<typeof Input> = {},
		hint?: React.ReactNode,
	) => {
		const error = errors[name as keyof typeof errors] as { message?: string } | undefined;
		// A custom onChange goes through register so react-hook-form still sees the value.
		const { onChange, ...inputProps } = props;
		return (
			<Field data-invalid={!!error}>
				<FieldLabel htmlFor={name}>{label}</FieldLabel>
				<Input id={name} aria-invalid={!!error} {...inputProps} {...form.register(name, onChange ? { onChange } : undefined)} />
				{hint && !error && <FieldDescription>{hint}</FieldDescription>}
				<FieldError errors={[error]} />
			</Field>
		);
	};
	const limit = (name: "maxDoctors" | "maxSecretaries" | "maxUsers" | "storageQuotaGb", label: string) =>
		text(name, label, { inputMode: "numeric", placeholder: "Illimité" });
	const shown = (value: string | undefined, one: string, many: string) =>
		value ? `${value} ${Number(value) > 1 ? many : one}` : `${many[0].toUpperCase()}${many.slice(1)} illimités`;
	const included = props.catalog.filter((f) => levelOf(f.key) !== "none");

	return (
		<form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
			<div className="grid gap-4">
				{!editing && props.templates && props.templates.length > 0 && (
					<div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
						<span className="me-1 text-muted-foreground">Partir de :</span>
						{[null, ...props.templates].map((plan) => {
							const selected = (plan?.key ?? null) === template;
							return (
								<button
									key={plan?.key ?? "blank"}
									type="button"
									aria-pressed={selected}
									onClick={() => startFrom(plan)}
									className={cn(
										"rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
										selected && "border-primary bg-primary/5 text-primary ring-1 ring-primary",
									)}
								>
									{plan ? `Offre ${plan.name}` : "Vierge"}
								</button>
							);
						})}
						<span className="text-xs text-muted-foreground">
							— copie tarifs, essai, limites et fonctionnalités ; à ajuster ensuite.
						</span>
					</div>
				)}

				<FormSection step={1} icon={Tag} title="Identité" description="Ce que voient les administrateurs en choisissant une offre.">
					<div className="grid gap-4 sm:grid-cols-2">
						{text("name", "Nom", {
							autoFocus: !editing,
							placeholder: "Pro",
							...(!editing && {
								onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
									if (!keyTouched) form.setValue("key", toKey(e.target.value), { shouldDirty: true });
								},
							}),
						})}
						<Field data-invalid={!!errors.key}>
							<FieldLabel htmlFor="key">Identifiant</FieldLabel>
							<Input
								id="key"
								readOnly={editing}
								placeholder="pro"
								className={cn("font-mono", editing && "bg-muted text-muted-foreground")}
								aria-invalid={!!errors.key}
								{...form.register("key", { onChange: () => setKeyTouched(true) })}
							/>
							{!errors.key && (
								<FieldDescription>
									{editing
										? "Fixé à la création."
										: keyTouched
											? "Utilisé dans le code ; non modifiable ensuite."
											: "Proposé à partir du nom ; non modifiable ensuite."}
								</FieldDescription>
							)}
							<FieldError errors={[errors.key]} />
						</Field>
					</div>
					{text("description", "Description courte", { placeholder: "Statistiques avancées et rappels patients." })}
				</FormSection>

				<FormSection
					step={2}
					icon={Wallet}
					title="Tarifs et essai"
					description="Montants hors taxe en dirhams ; l’essai précède la première facture."
				>
					<div className="grid gap-4 sm:grid-cols-3">
						{text("priceMonthly", "Prix mensuel (MAD)", { inputMode: "decimal", placeholder: "599" })}
						{text(
							"priceAnnual",
							"Prix annuel (MAD)",
							{ inputMode: "decimal", placeholder: "5990" },
							discount > 0 ? (
								<span className="text-emerald-700">−{discount} % vs 12 mensualités</span>
							) : discount < 0 ? (
								<span className="text-amber-700">Plus cher que 12 mensualités</span>
							) : undefined,
						)}
						{text("trialDays", "Essai gratuit (jours)", { inputMode: "numeric" }, "0 = facturé dès l’activation")}
					</div>
				</FormSection>

				<FormSection
					step={3}
					icon={Gauge}
					title="Limites"
					description="Copiées dans les quotas du cabinet à sa création. Vide = illimité."
				>
					<div className="grid gap-4 sm:grid-cols-4">
						{limit("maxDoctors", "Médecins")}
						{limit("maxSecretaries", "Secrétaires")}
						{limit("maxUsers", "Utilisateurs")}
						{limit("storageQuotaGb", "Stockage (Go)")}
					</div>
				</FormSection>

				<FormSection
					step={4}
					icon={Layers}
					title="Fonctionnalités"
					description="Le niveau de chaque fonctionnalité du catalogue dans cette offre."
				>
					<ul className="divide-y">
						{props.catalog.map((feature) => (
							<li key={feature.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
								<span className="grid min-w-0 gap-0.5">
									<span className="flex items-center gap-2 text-sm font-medium">
										{feature.name}
										{feature.status !== "active" && (
											<Badge variant="outline" className="border-transparent bg-muted text-[10px] font-normal">
												{feature.status === "beta" ? "bêta" : "désactivée"}
											</Badge>
										)}
									</span>
									{feature.category && <span className="text-xs text-muted-foreground">{feature.category}</span>}
								</span>
								<Controller
									control={form.control}
									name={`features.${feature.key}`}
									render={({ field }) => (
										<div role="radiogroup" aria-label={feature.name} className="flex rounded-lg bg-muted p-0.5 text-xs">
											{LEVELS.map((level) => {
												const selected = (field.value ?? "none") === level.value;
												return (
													<button
														key={level.value}
														type="button"
														role="radio"
														aria-checked={selected}
														onClick={() => field.onChange(level.value)}
														className={cn(
															"rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground",
															selected && level.tone,
															selected && "hover:text-white",
														)}
													>
														{level.label}
													</button>
												);
											})}
										</div>
									)}
								/>
							</li>
						))}
					</ul>
					<p className="text-xs text-muted-foreground">
						Les fonctionnalités viennent du code ; leur statut (bêta, désactivation) et les exceptions par cabinet se
						gèrent dans{" "}
						<Link href="/features" className="underline">
							Fonctionnalités
						</Link>
						.
					</p>
				</FormSection>
			</div>

			<aside className="grid gap-3 lg:sticky lg:top-4">
				<div className="rounded-xl border bg-card p-5">
					<h2 className="mb-3 font-semibold">Aperçu</h2>
					<div className="grid gap-2 rounded-xl border border-primary bg-primary/5 p-4 ring-1 ring-primary">
						<span className="font-semibold">{v.name || "Nom de l’offre"}</span>
						<span className="tabular-nums leading-tight">
							<span className="text-xl font-semibold">{monthly ? formatPrice(monthly) : "— MAD"}</span>
							<span className="text-xs text-muted-foreground"> / mois</span>
						</span>
						{annual > 0 && (
						<span className="text-xs text-muted-foreground">
							ou {formatPrice(annual)} / an
							{discount > 0 && <span className="ms-1 rounded-full bg-emerald-50 px-1.5 text-emerald-700">−{discount} %</span>}
						</span>
						)}
						{v.description && <span className="text-xs text-muted-foreground">{v.description}</span>}
						<ul className="mt-1 grid gap-0.5 border-t pt-2 text-xs text-muted-foreground">
							<li>{shown(v.maxDoctors, "médecin", "médecins")}</li>
							<li>{shown(v.maxUsers, "utilisateur", "utilisateurs")}</li>
							<li>{v.storageQuotaGb ? `${v.storageQuotaGb} Go de stockage` : "Stockage illimité"}</li>
							<li>{Number(v.trialDays) ? `${v.trialDays} jours d’essai` : "Sans essai"}</li>
						</ul>
						{included.length === 0 && (
							<p className="border-t pt-2 text-xs text-muted-foreground">Aucune fonctionnalité incluse.</p>
						)}
						<ul className={cn("grid gap-1 text-xs", included.length > 0 && "border-t pt-2")}>
							{included.map((f) => {
									const level = levelOf(f.key);
									const Icon = level === "addon" ? Plus : level === "custom" ? Settings2 : level === "limited" ? Hash : Check;
									return (
										<li key={f.key} className="flex items-center gap-1.5">
											<Icon className={cn("size-3.5 shrink-0", level === "addon" ? "text-sky-600" : "text-emerald-600")} />
											<span className="truncate">{f.name}</span>
											{level !== "included" && (
												<span className="ms-auto shrink-0 text-muted-foreground">
													{LEVELS.find((l) => l.value === level)?.label.toLowerCase()}
												</span>
											)}
										</li>
									);
								})}
						</ul>
					</div>
				</div>

				{editing && (
					<Controller
						control={form.control}
						name="active"
						render={({ field }) => (
							<label
								htmlFor="active"
								className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border bg-card p-4"
							>
								<span className="grid gap-0.5">
									<span className="text-sm font-medium">Proposée aux nouveaux cabinets</span>
									<span className="text-xs text-muted-foreground">
										{field.value
											? "Visible lors de l’ajout d’un cabinet."
											: "Archivée : les cabinets abonnés la gardent, plus de nouvelles souscriptions."}
									</span>
								</span>
								<Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
							</label>
						)}
					/>
				)}

				<Button type="submit" className="w-full" disabled={isSubmitting || (editing && !isDirty)}>
					{isSubmitting && <Loader className="animate-spin" />}
					{editing ? (isDirty ? "Enregistrer les modifications" : "Aucune modification") : "Créer l’offre"}
				</Button>
				<Button asChild variant="ghost" className="w-full">
					<Link href="/plans">Annuler</Link>
				</Button>
				{editing && (
					<p className="text-xs text-muted-foreground">
						Les cabinets déjà abonnés gardent leur prix ; les limites ne s’appliquent qu’aux nouveaux cabinets.
					</p>
				)}
			</aside>
		</form>
	);
}
