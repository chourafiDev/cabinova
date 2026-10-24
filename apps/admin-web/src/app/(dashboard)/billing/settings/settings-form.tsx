"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Check, CircleAlert, Landmark, Loader, Mail, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { type BillingSettings, formatRib } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { FormSection } from "../../_components/shared/form-section";

const optional = (max: number) => z.string().trim().max(max);
const days = z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 60, "Entre 0 et 60");

const schema = z.object({
	companyName: z.string().trim().min(2, "Requis").max(120),
	address: optional(300),
	email: optional(200),
	ice: z.string().trim().refine((v) => !v || /^\d{15}$/.test(v), "ICE : 15 chiffres"),
	rc: optional(40),
	taxId: optional(40),
	accountHolder: z.string().trim().min(2, "Requis").max(120),
	bankName: z.string().trim().min(2, "Requis").max(120),
	rib: z
		.string()
		.transform((v) => v.replace(/\s+/g, ""))
		.refine((v) => /^\d{24}$/.test(v), "Le RIB compte 24 chiffres"),
	swift: z.string().trim().toUpperCase().refine((v) => !v || /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(v), "Code SWIFT invalide"),
	graceDays: days,
	invoiceDaysBefore: days,
});
type SettingsInput = z.input<typeof schema>;


/**
 * Who issues the invoices and where clients send their transfers. Live
 * preview of the payment block exactly as it appears on invoices and
 * e-mails; the save button lives with the preview.
 */
export function BillingSettingsForm({ settings, readOnly }: { settings: BillingSettings; readOnly: boolean }) {
	const router = useRouter();
	const s = settings.configured ? settings : null;
	const form = useForm<SettingsInput, unknown, z.output<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			companyName: s?.companyName ?? "",
			address: s?.address ?? "",
			email: s?.email ?? "",
			ice: s?.ice ?? "",
			rc: s?.rc ?? "",
			taxId: s?.taxId ?? "",
			accountHolder: s?.accountHolder ?? "",
			bankName: s?.bankName ?? "",
			rib: s ? formatRib(s.rib) : "",
			swift: s?.swift ?? "",
			graceDays: String(settings.graceDays),
			invoiceDaysBefore: String(settings.invoiceDaysBefore),
		},
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const v = useWatch({ control: form.control });
	const ribDigits = (v.rib ?? "").replace(/\D/g, "");
	const ribComplete = ribDigits.length === 24;
	const grace = Number(v.graceDays) || 0;
	const before = Number(v.invoiceDaysBefore) || 0;

	const onSubmit = form.handleSubmit(
		async (values) => {
			try {
				await api("/billing/settings", {
					method: "PUT",
					body: JSON.stringify({
						...values,
						graceDays: Number(values.graceDays),
						invoiceDaysBefore: Number(values.invoiceDaysBefore),
					}),
				});
				toast.success("Coordonnées de facturation enregistrées");
				form.reset({ ...form.getValues(), rib: formatRib(values.rib) });
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
			}
		},
		() => toast.error("Vérifiez les champs signalés."),
	);

	const text = (
		name: FieldPath<SettingsInput>,
		label: string,
		props: React.ComponentProps<typeof Input> = {},
		hint?: React.ReactNode,
	) => (
		<Field data-invalid={!!errors[name]}>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			<Input id={name} disabled={readOnly} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
			{hint && !errors[name] && <FieldDescription>{hint}</FieldDescription>}
			<FieldError errors={[errors[name]]} />
		</Field>
	);

	return (
		<form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
			<div className="grid gap-4">
				<FormSection
					step={1}
					icon={Landmark}
					title="Compte bancaire"
					description="Le compte sur lequel les cabinets vous paient par virement."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						{text("accountHolder", "Titulaire du compte", { placeholder: "Nom exact sur le compte" })}
						{text("bankName", "Banque", { placeholder: "Attijariwafa bank, CIH, BMCE…" })}
					</div>
					<Field data-invalid={!!errors.rib}>
						<div className="flex items-center justify-between">
							<FieldLabel htmlFor="rib">RIB</FieldLabel>
							<span
								className={cn(
									"flex items-center gap-1 text-xs tabular-nums",
									ribComplete ? "text-emerald-700" : "text-muted-foreground",
								)}
							>
								{ribComplete && <Check className="size-3.5" />}
								{ribDigits.length} / 24 chiffres
							</span>
						</div>
						<Input
							id="rib"
							disabled={readOnly}
							inputMode="numeric"
							placeholder="000 000 0000000000000000 00"
							className="font-mono tracking-wide"
							aria-invalid={!!errors.rib}
							{...form.register("rib")}
						/>
						{ribComplete && !errors.rib ? (
							<div className="grid grid-cols-[auto_auto_1fr_auto] gap-2 text-center text-xs">
								{[
									["Banque", ribDigits.slice(0, 3)],
									["Ville", ribDigits.slice(3, 6)],
									["N° de compte", ribDigits.slice(6, 22)],
									["Clé", ribDigits.slice(22)],
								].map(([label, part]) => (
									<span key={label} className="grid min-w-0 rounded-md bg-muted px-2 py-1">
										<span className="text-muted-foreground">{label}</span>
										<span className="truncate font-mono">{part}</span>
									</span>
								))}
							</div>
						) : (
							!errors.rib && <FieldDescription>Les espaces sont acceptés.</FieldDescription>
						)}
						<FieldError errors={[errors.rib]} />
					</Field>
					<div className="sm:w-1/2">
						{text("swift", "Code SWIFT", { placeholder: "BCMAMAMC" }, "Facultatif — pour les virements depuis l’étranger.")}
					</div>
				</FormSection>

				<FormSection
					step={2}
					icon={ReceiptText}
					title="Émetteur des factures"
					description="Votre identité légale, en tête de chaque facture."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						{text("companyName", "Raison sociale")}
						{text("email", "E-mail de facturation", { type: "email", placeholder: "facturation@cabinova.ma" })}
					</div>
					{text("address", "Adresse", { placeholder: "Adresse du siège" })}
					<div className="grid gap-4 sm:grid-cols-3">
						{text("ice", "ICE", { inputMode: "numeric", placeholder: "15 chiffres" })}
						{text("rc", "RC", { placeholder: "Registre du commerce" })}
						{text("taxId", "IF", { placeholder: "Identifiant fiscal" })}
					</div>
				</FormSection>

				<FormSection
					step={3}
					icon={CalendarClock}
					title="Délais de paiement"
					description="Quand les factures partent, et quand elles passent en retard."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						{text("invoiceDaysBefore", "Facturer le renouvellement", { inputMode: "numeric" }, "jours avant l’échéance")}
						{text("graceDays", "Délai de paiement", { inputMode: "numeric" }, "jours après le début de la période")}
					</div>
					<ol className="grid gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
						{[
							{ icon: Mail, title: `J−${before}`, text: "Facture envoyée avec votre RIB" },
							{ icon: CalendarClock, title: "J", text: "Début de la nouvelle période" },
							{ icon: CircleAlert, title: `J+${grace}`, text: "Sans virement : « En retard » et rappel" },
						].map((step) => (
							<li key={step.title + step.text} className="flex items-start gap-2">
								<step.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
								<span>
									<span className="font-semibold tabular-nums">{step.title}</span>
									<span className="text-muted-foreground"> — {step.text}</span>
								</span>
							</li>
						))}
					</ol>
				</FormSection>
			</div>

			<aside className="grid gap-3 lg:sticky lg:top-4">
				<div className="rounded-xl border bg-card p-5">
					<div className="mb-3 flex items-center justify-between gap-2">
						<h2 className="font-semibold">Aperçu sur la facture</h2>
						<Badge
							variant="outline"
							className={cn(
								"border-transparent",
								settings.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
							)}
						>
							{settings.configured ? "Configuré" : "À configurer"}
						</Badge>
					</div>
					<div className="grid gap-3 rounded-lg border bg-white p-4 text-xs text-zinc-900">
						<div className="grid gap-0.5">
							<span className="flex items-center gap-1.5 font-semibold">
								<span className="flex size-5 items-center justify-center rounded bg-[#613f75] text-[10px] font-bold text-white">
									C
								</span>
								{v.companyName || "Raison sociale"}
							</span>
							{v.address && <span className="text-zinc-500">{v.address}</span>}
							{(v.ice || v.rc || v.taxId) && (
								<span className="text-[10px] text-zinc-500">
									{[v.ice && `ICE ${v.ice}`, v.rc && `RC ${v.rc}`, v.taxId && `IF ${v.taxId}`].filter(Boolean).join(" · ")}
								</span>
							)}
						</div>
						<div className="grid gap-1.5 rounded-md bg-zinc-50 p-3">
							<span className="font-semibold">Paiement par virement bancaire</span>
							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
								<dt className="text-zinc-500">Titulaire</dt>
								<dd className="truncate">{v.accountHolder || "—"}</dd>
								<dt className="text-zinc-500">Banque</dt>
								<dd className="truncate">{v.bankName || "—"}</dd>
								<dt className="text-zinc-500">RIB</dt>
								<dd className="font-mono">{ribComplete ? formatRib(ribDigits) : "—"}</dd>
								{v.swift && (
									<>
										<dt className="text-zinc-500">SWIFT</dt>
										<dd className="font-mono">{v.swift.toUpperCase()}</dd>
									</>
								)}
								<dt className="text-zinc-500">Référence</dt>
								<dd className="font-semibold">F-2026-000123</dd>
							</dl>
						</div>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Le même bloc figure dans l’e-mail de chaque facture. Le numéro de facture sert de référence de virement.
					</p>
				</div>
				{!readOnly && (
					<Button type="submit" disabled={!isDirty || isSubmitting} className="w-full">
						{isSubmitting && <Loader className="animate-spin" />}
						{isDirty ? "Enregistrer les modifications" : "Aucune modification"}
					</Button>
				)}
			</aside>
		</form>
	);
}
