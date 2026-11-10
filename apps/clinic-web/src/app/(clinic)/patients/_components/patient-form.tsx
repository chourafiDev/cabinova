"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, type FieldErrors, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import {
	IconCall,
	IconChevronDown,
	IconChevronRight,
	IconContact,
	IconLocation,
	IconNote,
	IconPlus,
	IconShieldCheck,
	IconSpinner,
	IconUsers,
} from "@/components/icons";
import { useModifierLabel } from "@/components/keyboard-shortcuts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError, api } from "@/lib/api-client";
import {
	ageOf,
	COVERAGE_LABELS,
	type Coverage,
	formatFileNumber,
	formatPhone,
	type Homonym,
	type Patient,
	type PatientInput,
	patientSchemaOf,
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
	const t = useTranslations("patients.form");
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
					{!open && <span className="text-muted-foreground truncate text-xs">{summary ?? t("optional")}</span>}
				</span>
				{open ? (
					<IconChevronDown className="text-muted-foreground size-4 rotate-180 transition-transform" />
				) : summary ? (
					<IconChevronDown className="text-muted-foreground size-4 transition-transform" />
				) : (
					<IconPlus className="text-muted-foreground size-4" />
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
	submitLabel,
	autoFocus = !patientId,
}: {
	patientId?: string;
	defaultValues: PatientInput;
	onSaved: (patient: Patient, next: "file" | "book") => void;
	onCancel: () => void;
	/** A new patient for another flow (the waiting room): one button, this label. */
	submitLabel?: string;
	/** Focus the name field (not when a tab button keeps the focus: it would blur it into an error). */
	autoFocus?: boolean;
}) {
	const t = useTranslations("patients.form");
	const common = useTranslations("common");
	const errorText = useTranslations("patients.errors");
	const form = useForm<PatientInput>({
		resolver: zodResolver(patientSchemaOf(errorText)),
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

	// Same name as another file: shown while typing, saved only once confirmed.
	const names = useDebouncedValue({ firstName: values.firstName?.trim() ?? "", lastName: values.lastName?.trim() ?? "" }, 350);
	const renamed = names.firstName !== defaultValues.firstName.trim() || names.lastName !== defaultValues.lastName.trim();
	const homonymQuery = useQuery({
		queryKey: ["patient-homonyms", names, patientId ?? null],
		queryFn: () =>
			api<Homonym[]>(
				`/patients/homonyms?${new URLSearchParams({ ...names, ...(patientId && { exceptId: patientId }) })}`,
			),
		enabled: !!names.firstName && !!names.lastName && renamed,
		staleTime: 30_000,
	});
	// The API's answer when saving beat the check (typed, then saved at once).
	const [refused, setRefused] = useState<{ key: string; patients: Homonym[] } | null>(null);
	const nameKey = `${values.firstName?.trim()}|${values.lastName?.trim()}`.toLowerCase();
	const homonyms = (renamed && homonymQuery.data) || (refused?.key === nameKey ? refused.patients : []);
	// Confirmed for these names only: another name asks again.
	const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
	const confirmed = confirmedFor === nameKey;
	const [mustConfirm, setMustConfirm] = useState(false);
	const [opening, setOpening] = useState<string | null>(null);

	const openExisting = async (id: string) => {
		setOpening(id);
		try {
			onSaved(await api<Patient>(`/patients/${id}`), "file");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
			setOpening(null);
		}
	};

	const submit = (next: "file" | "book") =>
		form.handleSubmit(async (input) => {
			if (homonyms.length && !confirmed) {
				setMustConfirm(true);
				document.getElementById("homonyms")?.scrollIntoView({ behavior: "smooth", block: "center" });
				return;
			}
			try {
				const patient = await api<Patient>(patientId ? `/patients/${patientId}` : "/patients", {
					method: patientId ? "PUT" : "POST",
					body: JSON.stringify({ ...input, allowHomonym: confirmed }),
				});
				toast.success(patientId ? t("saved") : t("created", { number: patient.fileNumber }));
				onSaved(patient, next);
			} catch (err) {
				if (err instanceof ApiError && err.code === "PATIENT_HOMONYM") {
					setRefused({ key: nameKey, patients: err.details.patients as Homonym[] });
					setMustConfirm(true);
					return;
				}
				if (err instanceof ApiError && err.code === "CIN_TAKEN") {
					form.setError("cin", { message: err.message });
					return;
				}
				toast.error(err instanceof Error ? err.message : t("saveError"));
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
			? [common(`coverage.${values.coverage}`), values.insurer, values.coverageNumber].filter(Boolean).join(" · ")
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
						{input("lastName", t("lastName"), { required: true, autoComplete: "off", autoFocus })}
						{input("firstName", t("firstName"), { required: true, autoComplete: "off" })}
					</div>
					{homonyms.length > 0 && (
						<HomonymCard
							patients={homonyms}
							editing={!!patientId}
							picking={!!submitLabel}
							opening={opening}
							onUse={openExisting}
							confirmed={confirmed}
							onConfirm={(checked) => {
								setConfirmedFor(checked ? nameKey : null);
								if (checked) setMustConfirm(false);
							}}
							error={mustConfirm && !confirmed}
						/>
					)}
					<div className="grid gap-4 sm:grid-cols-2">
						<Controller
							control={form.control}
							name="sex"
							render={({ field }) => (
								<Field data-invalid={!!errors.sex}>
									<Label required>{t("sex")}</Label>
									<div role="radiogroup" aria-label={t("sex")} className="bg-muted grid h-9 grid-cols-2 rounded-lg p-0.5">
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
												{common(`sex.${value}`)}
											</button>
										))}
									</div>
									<FieldError errors={[errors.sex]} />
								</Field>
							)}
						/>
						<Field data-invalid={!!errors.birthDate}>
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="birthDate">{t("birthDate")}</Label>
								{age !== null && (
									<span className="bg-muted text-muted-foreground rounded-full px-2 text-xs tabular-nums">{common("age", { age })}</span>
								)}
							</div>
							<Controller
								control={form.control}
								name="birthDate"
								render={({ field }) => (
									<DatePicker
										id="birthDate"
										value={field.value ?? ""}
										onChange={field.onChange}
										max={today()}
										years
										clearable
										invalid={!!errors.birthDate}
									/>
								)}
							/>
							<FieldError errors={[errors.birthDate]} />
						</Field>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!errors.phone}>
							<Label htmlFor="phone">{t("phone")}</Label>
							<div dir="ltr" className="relative">
								<IconCall className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
								<Input
									id="phone"
									type="tel"
									inputMode="tel"
									placeholder="06 12 34 56 78"
									className="ps-9 rtl:text-left"
									aria-invalid={!!errors.phone}
									{...form.register("phone")}
								/>
							</div>
							<FieldError errors={[errors.phone]} />
						</Field>
						{input("cin", t("cin"), { placeholder: "BK123456", className: "uppercase" })}
					</div>
				</section>

				<div className="grid gap-2">
					<p className="text-muted-foreground text-xs font-medium">{t("more")}</p>

					<OptionalSection
						icon={IconLocation}
						title={t("addressTitle")}
						summary={[values.address, values.city, values.email].filter(Boolean).join(" · ") || undefined}
						open={isOpen("address")}
						onToggle={() => toggle("address")}
					>
						<div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
							{input("address", t("address"))}
							{input("city", t("city"))}
						</div>
						{input("email", t("email"), { type: "email", placeholder: t("emailPlaceholder") })}
					</OptionalSection>

					<OptionalSection
						icon={IconShieldCheck}
						title={t("coverageTitle")}
						summary={coverageSummary}
						open={isOpen("coverage")}
						onToggle={() => toggle("coverage")}
					>
						<Controller
							control={form.control}
							name="coverage"
							render={({ field }) => (
								<Field>
									<Label>{t("scheme")}</Label>
									<div role="radiogroup" aria-label={t("scheme")} className="flex flex-wrap gap-1.5">
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
												{common(`coverage.${value}`)}
											</button>
										))}
									</div>
								</Field>
							)}
						/>
						{values.coverage !== "none" && (
							<div className="grid gap-4 sm:grid-cols-2">
								{values.coverage === "private" &&
									input("insurer", t("insurer"), { placeholder: t("insurerPlaceholder") })}
								{input("coverageNumber", t("registration"))}
							</div>
						)}
					</OptionalSection>

					<OptionalSection
						icon={IconContact}
						title={t("emergency")}
						summary={[values.emergencyContactName, values.emergencyContactPhone].filter(Boolean).join(" · ") || undefined}
						open={isOpen("emergency")}
						onToggle={() => toggle("emergency")}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							{input("emergencyContactName", t("nameAndLink"), { placeholder: t("nameAndLinkPlaceholder") })}
							{input("emergencyContactPhone", t("phone"), { type: "tel", inputMode: "tel" })}
						</div>
					</OptionalSection>

					<OptionalSection
						icon={IconNote}
						title={t("note")}
						summary={values.notes || undefined}
						open={isOpen("notes")}
						onToggle={() => toggle("notes")}
					>
						<Field data-invalid={!!errors.notes}>
							<Textarea
								id="notes"
								rows={3}
								placeholder={t("notePlaceholder")}
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
					<span className="text-primary">*</span> {t("required")} ·{" "}
					<kbd className="font-mono">{modifier}+↵</kbd> {t("toSave")}
				</p>
				<Button type="button" variant="ghost" onClick={onCancel}>
					{t("cancel")}
				</Button>
				{patientId ? (
					<Button type="submit" disabled={isSubmitting || !isDirty}>
						{isSubmitting && <IconSpinner className="animate-spin" />}
						{t("save")}
					</Button>
				) : submitLabel ? (
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <IconSpinner className="animate-spin" />}
						{submitLabel}
					</Button>
				) : (
					<>
						<Button type="button" variant="outline" disabled={isSubmitting} onClick={submit("book")}>
							{t("createAndBook")}
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <IconSpinner className="animate-spin" />}
							{t("create")}
						</Button>
					</>
				)}
			</div>
		</form>
	);
}

/**
 * Files with the same name: open (or pick) the existing one, or say it is
 * another person. Never a hard block: homonyms are common.
 */
function HomonymCard({
	patients,
	editing,
	picking,
	opening,
	onUse,
	confirmed,
	onConfirm,
	error,
}: {
	patients: Homonym[];
	/** Renaming a file: nothing to open, only the confirmation. */
	editing: boolean;
	/** Another flow (the waiting room) takes the patient rather than opening their file. */
	picking: boolean;
	opening: string | null;
	onUse: (id: string) => void;
	confirmed: boolean;
	onConfirm: (checked: boolean) => void;
	error: boolean;
}) {
	const t = useTranslations("patients.form.homonym");
	const common = useTranslations("common");
	return (
		<section
			id="homonyms"
			aria-live="polite"
			className={cn(
				"grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900",
				error && "ring-destructive/40 ring-3",
			)}
		>
			<div className="flex items-start gap-2.5">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
					<IconUsers className="size-4" />
				</span>
				<div className="grid gap-0.5">
					<p className="text-sm font-semibold">{t("title", { count: patients.length })}</p>
					<p className="text-xs text-amber-800">{t("hint")}</p>
				</div>
			</div>
			<ul className="grid gap-1.5">
				{patients.map((p) => {
					const age = ageOf(p.birthDate);
					const archived = p.archivedAt !== null;
					return (
						<li key={p.id} className="bg-background text-foreground flex items-center gap-3 rounded-lg border px-3 py-2">
							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-2 truncate text-sm font-medium">
									<span className="truncate">
										{p.lastName.toUpperCase()} {p.firstName}
									</span>
									{archived && <Badge variant="secondary">{t("archived")}</Badge>}
								</p>
								<p className="text-muted-foreground truncate text-xs tabular-nums">
									{[
										formatFileNumber(p.fileNumber),
										common(`sex.${p.sex}`),
										age !== null && common("age", { age }),
										p.phone && formatPhone(p.phone),
										p.cin,
									]
										.filter(Boolean)
										.join(" · ")}
								</p>
							</div>
							{!editing && !(picking && archived) && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={opening !== null}
									onClick={() => onUse(p.id)}
								>
									{opening === p.id && <IconSpinner className="animate-spin" />}
									{picking ? t("pick") : t("open")}
									<IconChevronRight className="rtl:-scale-x-100" />
								</Button>
							)}
						</li>
					);
				})}
			</ul>
			<label className="flex items-start gap-2 text-sm">
				<Checkbox checked={confirmed} onCheckedChange={(v) => onConfirm(v === true)} className="mt-0.5 bg-background" />
				<span>{editing ? t("confirmEdit") : t("confirm")}</span>
			</label>
			{error && (
				<p role="alert" className="text-destructive text-xs font-medium">
					{t("required")}
				</p>
			)}
		</section>
	);
}
