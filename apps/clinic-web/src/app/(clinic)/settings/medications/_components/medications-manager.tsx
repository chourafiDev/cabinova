"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	IconEdit,
	IconEyeOff,
	IconPlus,
	IconRefresh,
	IconSearch,
	IconSpinner,
	IconStar,
	IconTrash,
	IconUndo,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import {
	CUSTOM_MEDICATIONS_KEY,
	type CustomMedication,
	formatPpv,
	MEDICATION_FAVORITES_KEY,
	MEDICATION_OVERRIDES_KEY,
	type MedicationOverride,
	type MedicationSearch,
	type MedicationSuggestion,
	medicationSearchKey,
} from "@/lib/medications";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

/** "DOLIPRANE" + "1 G" → "DOLIPRANE 1 G". */
const nameOf = (name: string | null | undefined, dosage: string | null | undefined) =>
	[name, dosage].filter(Boolean).join(" ");

/**
 * Mes médicaments: what the doctor set on AMMPS medicines (their wording,
 * usual posology, favorites, hidden ones), the AMMPS changes to review,
 * and their own medicines outside the list. Suggested in their ordonnances;
 * no one else in the cabinet sees them.
 */
export function MedicationsManager() {
	const t = useTranslations("settings.medications");
	const queryClient = useQueryClient();
	const overrides = useQuery({
		queryKey: MEDICATION_OVERRIDES_KEY,
		queryFn: () => api<MedicationOverride[]>("/medications/overrides"),
	});
	const customs = useQuery({
		queryKey: CUSTOM_MEDICATIONS_KEY,
		queryFn: () => api<CustomMedication[]>("/medications/custom"),
	});
	const [search, setSearch] = useState("");
	const [editingOverride, setEditingOverride] = useState<OverrideTarget | null>(null);
	const [editingCustom, setEditingCustom] = useState<CustomMedication | "new" | null>(null);
	const [picking, setPicking] = useState(false);

	/** Everything the ordonnance suggests may have changed. */
	const refresh = () => {
		for (const key of [MEDICATION_OVERRIDES_KEY, CUSTOM_MEDICATIONS_KEY, MEDICATION_FAVORITES_KEY, ["medications-search"]]) {
			void queryClient.invalidateQueries({ queryKey: key });
		}
	};

	const run = async (action: () => Promise<unknown>, done: string) => {
		try {
			await action();
			toast.success(done);
			refresh();
			return true;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
			return false;
		}
	};

	const q = fold(search.trim());
	const shownOverrides = (overrides.data ?? []).filter(
		(o) =>
			!q ||
			fold([o.customName, o.customDosage, o.ammps?.name, o.ammps?.dosage, o.ammps?.substances].filter(Boolean).join(" ")).includes(q),
	);
	const shownCustoms = (customs.data ?? []).filter(
		(c) => !q || fold([c.name, c.dosage, c.substances, c.form].filter(Boolean).join(" ")).includes(q),
	);
	const updates = (overrides.data ?? []).filter((o) => o.updatedByAmmps);
	const total = (overrides.data?.length ?? 0) + (customs.data?.length ?? 0);

	return (
		<>
			{updates.length > 0 && (
				<SettingsCard
					title={t("updates.title", { count: updates.length })}
					description={t("updates.description")}
					className="border-sky-200 dark:border-sky-900"
				>
					<ul className="grid gap-2">
						{updates.map((o) => (
							<li key={o.ammpsId} className="bg-muted/40 grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
								<div className="grid gap-0.5 text-sm">
									<p>
										<span className="text-muted-foreground">{t("updates.yours")} </span>
										<bdi className="font-medium">{nameOf(o.customName ?? o.baseName, o.customDosage ?? o.baseDosage)}</bdi>
									</p>
									<p>
										<span className="text-muted-foreground">{t("updates.ammpsBefore")} </span>
										<bdi className="line-through opacity-70">{nameOf(o.baseName, o.baseDosage)}</bdi>
										<span className="text-muted-foreground"> → </span>
										<bdi className="font-medium text-sky-700 dark:text-sky-400">{nameOf(o.ammps?.name, o.ammps?.dosage)}</bdi>
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										size="sm"
										onClick={() =>
											void run(
												() => api(`/medications/ammps/${o.ammpsId}/override/accept-ammps`, { method: "POST" }),
												t("updates.accepted"),
											)
										}
									>
										<IconRefresh /> {t("updates.accept")}
									</Button>
									<Button
										size="sm"
										variant="outline"
										// Saving their wording again records the AMMPS values it now stands for.
										onClick={() =>
											void run(
												() =>
													api(`/medications/ammps/${o.ammpsId}/override`, {
														method: "PUT",
														body: JSON.stringify({ customName: o.customName, customDosage: o.customDosage }),
													}),
												t("updates.kept"),
											)
										}
									>
										{t("updates.keep")}
									</Button>
								</div>
							</li>
						))}
					</ul>
				</SettingsCard>
			)}

			{total > 6 && (
				<div className="relative w-full sm:w-80">
					<IconSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
					<Input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("search")}
						aria-label={t("search")}
						className="bg-card ps-8"
					/>
				</div>
			)}

			<SettingsCard
				title={t("ammps.title")}
				description={t("ammps.description")}
				action={
					<Button size="sm" onClick={() => setPicking(true)}>
						<IconPlus /> {t("ammps.add")}
					</Button>
				}
			>
				{overrides.isPending ? (
					<Skeleton className="h-24 rounded-lg" />
				) : overrides.isError ? (
					<p className="text-destructive text-sm">{t("loadError")}</p>
				) : shownOverrides.length === 0 ? (
					<p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
						{q ? t("noMatch") : t("ammps.empty")}
					</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{shownOverrides.map((o) => {
							const renamed = !!(o.customName || o.customDosage);
							const shown = nameOf(o.customName ?? o.ammps?.name ?? o.baseName, o.customDosage ?? o.ammps?.dosage ?? o.baseDosage);
							return (
								<li key={o.ammpsId} className={cn("flex items-start gap-3 px-3 py-2.5", o.isHidden && "opacity-60")}>
									<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
										{o.isFavorite && <IconStar className="size-4 text-amber-500" aria-label={t("favorite")} />}
										{o.isHidden && <IconEyeOff className="text-muted-foreground size-4" aria-label={t("hidden")} />}
									</span>
									<div className="grid min-w-0 flex-1 gap-0.5">
										<p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
											<bdi>{shown}</bdi>
											{o.isHidden && <Tag>{t("hidden")}</Tag>}
											{o.ammps && !o.ammps.isActive && <Tag tone="warning">{t("ammps.removed")}</Tag>}
											{o.ammps?.availability === "withdrawn" && <Tag tone="warning">{t("ammps.withdrawn")}</Tag>}
											{o.updatedByAmmps && <Tag tone="info">{t("ammps.updated")}</Tag>}
										</p>
										{renamed && o.ammps && (
											<p className="text-muted-foreground text-xs">
												{t("ammps.officialName", { name: "\u2068" + nameOf(o.ammps.name, o.ammps.dosage) + "\u2069" })}
											</p>
										)}
										<p className="text-muted-foreground text-xs">
											{[o.ammps?.form?.toLowerCase(), o.ammps?.substances.split(/\s*\/\/\s*/).join(" + ").toLowerCase()]
												.filter(Boolean)
												.join(" · ")
												.replace(/^(.+)$/, "\u2068$1\u2069")}
										</p>
										{(o.defaultPosology || o.defaultDuration) && (
											<p className="text-xs italic">
												<bdi>{[o.defaultPosology, o.defaultDuration].filter(Boolean).join(" · ")}</bdi>
											</p>
										)}
									</div>
									<div className="flex shrink-0 items-center">
										<IconAction
											label={o.isFavorite ? t("unfavorite") : t("favorite")}
											onClick={() =>
												void run(
													() =>
														api(`/medications/ammps/${o.ammpsId}/override`, {
															method: "PUT",
															body: JSON.stringify({ isFavorite: !o.isFavorite }),
														}),
													o.isFavorite ? t("unfavorited") : t("favorited"),
												)
											}
											className={o.isFavorite ? "text-amber-500 hover:text-amber-600" : undefined}
										>
											<IconStar />
										</IconAction>
										<IconAction
											label={t("edit")}
											onClick={() => setEditingOverride({ ammpsId: o.ammpsId, ammps: o.ammps, override: o })}
										>
											<IconEdit />
										</IconAction>
										<ConfirmAction
											label={t("ammps.revert")}
											confirmLabel={t("ammps.confirmRevert")}
											icon={<IconUndo />}
											onConfirm={() =>
												run(() => api(`/medications/ammps/${o.ammpsId}/override`, { method: "DELETE" }), t("ammps.reverted"))
											}
										/>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</SettingsCard>

			<SettingsCard
				title={t("custom.title")}
				description={t("custom.description")}
				action={
					<Button size="sm" variant="outline" onClick={() => setEditingCustom("new")}>
						<IconPlus /> {t("custom.add")}
					</Button>
				}
			>
				{customs.isPending ? (
					<Skeleton className="h-24 rounded-lg" />
				) : customs.isError ? (
					<p className="text-destructive text-sm">{t("loadError")}</p>
				) : shownCustoms.length === 0 ? (
					<p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
						{q ? t("noMatch") : t("custom.empty")}
					</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{shownCustoms.map((c) => (
							<li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
									{c.isFavorite && <IconStar className="size-4 text-amber-500" aria-label={t("favorite")} />}
								</span>
								<div className="grid min-w-0 flex-1 gap-0.5">
									<p className="text-sm font-medium">
										<bdi>{nameOf(c.name, c.dosage)}</bdi>
									</p>
									{(c.form || c.substances || c.presentation) && (
										<p className="text-muted-foreground text-xs">
											<bdi>{[c.form, c.substances, c.presentation].filter(Boolean).join(" · ")}</bdi>
										</p>
									)}
									{(c.defaultPosology || c.defaultDuration) && (
										<p className="text-xs italic">
											<bdi>{[c.defaultPosology, c.defaultDuration].filter(Boolean).join(" · ")}</bdi>
										</p>
									)}
								</div>
								<div className="flex shrink-0 items-center">
									<IconAction
										label={c.isFavorite ? t("unfavorite") : t("favorite")}
										onClick={() =>
											void run(
												() =>
													api(`/medications/custom/${c.id}`, {
														method: "PATCH",
														body: JSON.stringify({ isFavorite: !c.isFavorite }),
													}),
												c.isFavorite ? t("unfavorited") : t("favorited"),
											)
										}
										className={c.isFavorite ? "text-amber-500 hover:text-amber-600" : undefined}
									>
										<IconStar />
									</IconAction>
									<IconAction label={t("edit")} onClick={() => setEditingCustom(c)}>
										<IconEdit />
									</IconAction>
									<ConfirmAction
										label={t("custom.delete", { name: c.name })}
										confirmLabel={t("custom.confirmDelete", { name: c.name })}
										icon={<IconTrash />}
										onConfirm={() =>
											run(() => api(`/medications/custom/${c.id}`, { method: "DELETE" }), t("custom.deleted", { name: c.name }))
										}
									/>
								</div>
							</li>
						))}
					</ul>
				)}
			</SettingsCard>

			<p className="text-muted-foreground text-xs">{t("privacy")}</p>

			<AmmpsPicker
				open={picking}
				onOpenChange={setPicking}
				onPick={(s) => {
					setPicking(false);
					const existing = overrides.data?.find((o) => o.ammpsId === s.ammpsId);
					setEditingOverride({
						ammpsId: s.ammpsId!,
						ammps: existing?.ammps ?? null,
						suggestion: s,
						override: existing,
					});
				}}
			/>
			{editingOverride && (
				<OverrideDialog
					target={editingOverride}
					onClose={() => setEditingOverride(null)}
					onSave={(body) =>
						run(
							() =>
								api(`/medications/ammps/${editingOverride.ammpsId}/override`, {
									method: "PUT",
									body: JSON.stringify(body),
								}),
							t("saved"),
						)
					}
				/>
			)}
			{editingCustom && (
				<CustomDialog
					medication={editingCustom === "new" ? null : editingCustom}
					onClose={() => setEditingCustom(null)}
					onSave={(body) =>
						run(
							() =>
								editingCustom === "new"
									? api("/medications/custom", { method: "POST", body: JSON.stringify(body) })
									: api(`/medications/custom/${editingCustom.id}`, { method: "PATCH", body: JSON.stringify(body) }),
							editingCustom === "new" ? t("custom.created", { name: body.name }) : t("saved"),
						)
					}
				/>
			)}
		</>
	);
}

function Tag({ tone, children }: { tone?: "warning" | "info"; children: React.ReactNode }) {
	return (
		<span
			className={cn(
				"rounded px-1 text-[10px] font-medium",
				tone === "warning"
					? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
					: tone === "info"
						? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
						: "bg-muted text-muted-foreground",
			)}
		>
			{children}
		</span>
	);
}

function IconAction({
	label,
	onClick,
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={cn("text-muted-foreground size-8", className)}
		>
			{children}
		</Button>
	);
}

/** A first click asks, a second one does it (delete, back to the AMMPS values). */
function ConfirmAction({
	label,
	confirmLabel,
	icon,
	onConfirm,
}: {
	label: string;
	confirmLabel: string;
	icon: React.ReactNode;
	onConfirm: () => Promise<boolean>;
}) {
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);
	return (
		<Button
			type="button"
			variant={confirming ? "destructive" : "ghost"}
			size="icon"
			className={cn("size-8", !confirming && "text-muted-foreground hover:text-destructive")}
			aria-label={confirming ? confirmLabel : label}
			title={confirming ? confirmLabel : label}
			disabled={pending}
			onBlur={() => setConfirming(false)}
			onClick={async () => {
				if (!confirming) return setConfirming(true);
				setPending(true);
				await onConfirm();
				setPending(false);
				setConfirming(false);
			}}
		>
			{pending ? <IconSpinner className="animate-spin" /> : icon}
		</Button>
	);
}

/** Search the AMMPS list to set something on one of its medicines. */
function AmmpsPicker({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (s: MedicationSuggestion) => void;
}) {
	const t = useTranslations("settings.medications.picker");
	const locale = useLocale();
	const [text, setText] = useState("");
	const [query, setQuery] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setQuery(text.trim()), 200);
		return () => clearTimeout(timer);
	}, [text]);
	const search = useQuery({
		queryKey: medicationSearchKey(query),
		queryFn: () => api<MedicationSearch>(`/medications/search?q=${encodeURIComponent(query)}`),
		enabled: open && query.length >= 2,
		placeholderData: keepPreviousData,
	});
	const results = (search.data?.items ?? []).filter((s) => s.source === "ammps");

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setText("");
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>
				<div className="relative">
					<IconSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
					<Input
						autoFocus
						type="search"
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder={t("placeholder")}
						aria-label={t("placeholder")}
						className="ps-8"
					/>
				</div>
				<ul className="-mx-1 grid max-h-80 gap-0.5 overflow-y-auto px-1">
					{query.length >= 2 && !search.isFetching && results.length === 0 && (
						<li className="text-muted-foreground py-6 text-center text-sm">
							{search.data?.catalog === false ? t("unavailable") : t("none")}
						</li>
					)}
					{search.isFetching && results.length === 0 && (
						<li className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
							<IconSpinner className="size-4 animate-spin" /> {t("searching")}
						</li>
					)}
					{results.map((s) => (
						<li key={s.key}>
							<button
								type="button"
								onClick={() => onPick(s)}
								className="hover:bg-accent focus-visible:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">
										{s.name}
										{s.dosage && <span className="font-normal"> {s.dosage}</span>}
									</p>
									<p className="text-muted-foreground truncate text-xs">
										{[s.form?.toLowerCase(), s.substances?.split(/\s*\/\/\s*/).join(" + ").toLowerCase()]
											.filter(Boolean)
											.join(" · ")}
									</p>
								</div>
								{s.ppv && (
									<span className="text-muted-foreground shrink-0 text-xs tabular-nums" dir="ltr">
										{formatPpv(s.ppv, locale)}
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}

type OverrideTarget = {
	ammpsId: number;
	ammps: MedicationOverride["ammps"];
	suggestion?: MedicationSuggestion;
	override?: MedicationOverride;
};

type OverrideBody = {
	customName: string | null;
	customDosage: string | null;
	defaultPosology: string | null;
	defaultDuration: string | null;
	isFavorite: boolean;
	isHidden: boolean;
};

/** The doctor's take on one AMMPS medicine: empty fields mean "as the AMMPS says". */
function OverrideDialog({
	target,
	onClose,
	onSave,
}: {
	target: OverrideTarget;
	onClose: () => void;
	onSave: (body: OverrideBody) => Promise<boolean>;
}) {
	const t = useTranslations("settings.medications.override");
	const o = target.override;
	// The official values, from the list or the search result.
	const official = {
		name: target.ammps?.name ?? target.suggestion?.name ?? o?.baseName ?? "",
		dosage: target.ammps?.dosage ?? target.suggestion?.dosage ?? o?.baseDosage ?? null,
		form: target.ammps?.form ?? target.suggestion?.form ?? null,
	};
	const [form, setForm] = useState({
		customName: o?.customName ?? "",
		customDosage: o?.customDosage ?? "",
		defaultPosology: o?.defaultPosology ?? target.suggestion?.defaultPosology ?? "",
		defaultDuration: o?.defaultDuration ?? target.suggestion?.defaultDuration ?? "",
		isFavorite: o?.isFavorite ?? target.suggestion?.isFavorite ?? false,
		isHidden: o?.isHidden ?? false,
	});
	const [saving, setSaving] = useState(false);
	const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		const ok = await onSave({
			customName: form.customName.trim() || null,
			customDosage: form.customDosage.trim() || null,
			defaultPosology: form.defaultPosology.trim() || null,
			defaultDuration: form.defaultDuration.trim() || null,
			isFavorite: form.isFavorite,
			isHidden: form.isHidden,
		});
		setSaving(false);
		if (ok) onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<form onSubmit={save} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>{nameOf(official.name, official.dosage)}</DialogTitle>
						<DialogDescription>
							{official.form ? `${official.form.toLowerCase()} · ` : ""}
							{t("description")}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
						<Field id="ov-name" label={t("name")}>
							<Input
								id="ov-name"
								value={form.customName}
								onChange={(e) => set({ customName: e.target.value })}
								placeholder={official.name}
								maxLength={200}
							/>
						</Field>
						<Field id="ov-dosage" label={t("dosage")}>
							<Input
								id="ov-dosage"
								value={form.customDosage}
								onChange={(e) => set({ customDosage: e.target.value })}
								placeholder={official.dosage ?? ""}
								maxLength={100}
							/>
						</Field>
					</div>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
						<Field id="ov-posology" label={t("posology")}>
							<Input
								id="ov-posology"
								value={form.defaultPosology}
								onChange={(e) => set({ defaultPosology: e.target.value })}
								placeholder={t("posologyPlaceholder")}
								maxLength={300}
							/>
						</Field>
						<Field id="ov-duration" label={t("duration")}>
							<Input
								id="ov-duration"
								value={form.defaultDuration}
								onChange={(e) => set({ defaultDuration: e.target.value })}
								placeholder={t("durationPlaceholder")}
								maxLength={100}
							/>
						</Field>
					</div>
					<div className="grid gap-2 rounded-lg border p-3">
						<Toggle id="ov-favorite" label={t("favorite")} hint={t("favoriteHint")} checked={form.isFavorite} onChange={(v) => set({ isFavorite: v })} />
						<Toggle id="ov-hidden" label={t("hidden")} hint={t("hiddenHint")} checked={form.isHidden} onChange={(v) => set({ isHidden: v })} />
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("cancel")}
						</Button>
						<Button type="submit" disabled={saving}>
							{saving && <IconSpinner className="animate-spin" />} {t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

type CustomBody = Omit<CustomMedication, "id">;

/** A medicine outside the AMMPS list: only its name is needed. */
function CustomDialog({
	medication,
	onClose,
	onSave,
}: {
	medication: CustomMedication | null;
	onClose: () => void;
	onSave: (body: CustomBody) => Promise<boolean>;
}) {
	const t = useTranslations("settings.medications.customForm");
	const [form, setForm] = useState({
		name: medication?.name ?? "",
		dosage: medication?.dosage ?? "",
		form: medication?.form ?? "",
		substances: medication?.substances ?? "",
		presentation: medication?.presentation ?? "",
		defaultPosology: medication?.defaultPosology ?? "",
		defaultDuration: medication?.defaultDuration ?? "",
		isFavorite: medication?.isFavorite ?? false,
	});
	const [saving, setSaving] = useState(false);
	const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
	const text = (v: string) => v.trim() || null;

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.name.trim()) return;
		setSaving(true);
		const ok = await onSave({
			name: form.name.trim(),
			dosage: text(form.dosage),
			form: text(form.form),
			substances: text(form.substances),
			presentation: text(form.presentation),
			defaultPosology: text(form.defaultPosology),
			defaultDuration: text(form.defaultDuration),
			isFavorite: form.isFavorite,
		});
		setSaving(false);
		if (ok) onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<form onSubmit={save} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>{medication ? t("editTitle") : t("newTitle")}</DialogTitle>
						<DialogDescription>{t("description")}</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
						<Field id="cm-name" label={t("name")}>
							<Input
								id="cm-name"
								autoFocus
								required
								value={form.name}
								onChange={(e) => set({ name: e.target.value })}
								placeholder={t("namePlaceholder")}
								maxLength={200}
							/>
						</Field>
						<Field id="cm-dosage" label={t("dosage")}>
							<Input id="cm-dosage" value={form.dosage} onChange={(e) => set({ dosage: e.target.value })} maxLength={100} />
						</Field>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field id="cm-form" label={t("form")}>
							<Input
								id="cm-form"
								value={form.form}
								onChange={(e) => set({ form: e.target.value })}
								placeholder={t("formPlaceholder")}
								maxLength={100}
							/>
						</Field>
						<Field id="cm-substances" label={t("substances")}>
							<Input id="cm-substances" value={form.substances} onChange={(e) => set({ substances: e.target.value })} maxLength={300} />
						</Field>
					</div>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
						<Field id="cm-posology" label={t("posology")}>
							<Input id="cm-posology" value={form.defaultPosology} onChange={(e) => set({ defaultPosology: e.target.value })} maxLength={300} />
						</Field>
						<Field id="cm-duration" label={t("duration")}>
							<Input id="cm-duration" value={form.defaultDuration} onChange={(e) => set({ defaultDuration: e.target.value })} maxLength={100} />
						</Field>
					</div>
					<div className="rounded-lg border p-3">
						<Toggle id="cm-favorite" label={t("favorite")} checked={form.isFavorite} onChange={(v) => set({ isFavorite: v })} />
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("cancel")}
						</Button>
						<Button type="submit" disabled={saving || !form.name.trim()}>
							{saving && <IconSpinner className="animate-spin" />} {t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			{children}
		</div>
	);
}

function Toggle({
	id,
	label,
	hint,
	checked,
	onChange,
}: {
	id: string;
	label: string;
	hint?: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<Label htmlFor={id} className="grid gap-0.5 font-normal">
				<span className="text-sm font-medium">{label}</span>
				{hint && <span className="text-muted-foreground text-xs">{hint}</span>}
			</Label>
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
		</div>
	);
}
