"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Abbreviation } from "@/components/act-picker";
import {
	IconArchive,
	IconCheck,
	IconClose,
	IconEdit,
	IconPlus,
	IconRestore,
	IconSearch,
	IconSpinner,
	IconTrash,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { ACT_COLORS, ACT_SWATCHES, type Act, type ActColor, actMatches, actSwatch, parseMad, toInput } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

/**
 * Tarifs: the price list as a table (couleur et libellé, abréviation,
 * montant), searched by name or abbreviation. The colour is the act's
 * appointments' colour on the agenda. Archived acts stay on past visits; an act never
 * charged can be deleted for good.
 */
export function ActsManager({ acts }: { acts: Act[] }) {
	const [editing, setEditing] = useState<string | "new" | null>(acts.length === 0 ? "new" : null);
	const [search, setSearch] = useState("");
	const t = useTranslations("settings.acts");
	const active = acts.filter((a) => a.active);
	const shown = active.filter((a) => actMatches(a, search));
	const archived = acts.filter((a) => !a.active && actMatches(a, search));

	return (
		<>
			<SettingsCard
				title={t("title")}
				description={t("description")}
				action={
					editing !== "new" && (
						<Button size="sm" onClick={() => setEditing("new")}>
							<IconPlus /> {t("new")}
						</Button>
					)
				}
			>
				<div className="grid gap-3">
					{active.length > 0 && (
						<div className="relative w-full sm:w-80">
							<IconSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
							<Input
								type="search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={t("search")}
								aria-label={t("search")}
								className="ps-8"
							/>
						</div>
					)}
					<div className="overflow-hidden rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("columns.name")}</TableHead>
									<TableHead className="w-36">{t("columns.abbreviation")}</TableHead>
									<TableHead className="w-36 text-end">{t("columns.price")}</TableHead>
									<TableHead className="w-28">
										<span className="sr-only">{t("columns.actions")}</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{editing === "new" && <ActForm onDone={() => setEditing(null)} />}
								{shown.map((a) =>
									editing === a.id ? (
										<ActForm key={a.id} act={a} onDone={() => setEditing(null)} />
									) : (
										<ActRow key={a.id} act={a} onEdit={() => setEditing(a.id)} />
									),
								)}
								{shown.length === 0 && editing !== "new" && (
									<TableRow>
										<TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
											{active.length === 0 ? t("empty") : t("noMatch")}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</SettingsCard>
			{archived.length > 0 && (
				<SettingsCard title={t("archivedTitle")} description={t("archivedHint")}>
					<div className="overflow-hidden rounded-lg border">
						<Table>
							<TableBody>
								{archived.map((a) => (
									<ActRow key={a.id} act={a} />
								))}
							</TableBody>
						</Table>
					</div>
				</SettingsCard>
			)}
		</>
	);
}

function ActRow({ act, onEdit }: { act: Act; onEdit?: () => void }) {
	const router = useRouter();
	const [pending, setPending] = useState<"toggle" | "delete" | null>(null);
	// Deleting can't be undone: a first click asks, a second one deletes.
	const [confirming, setConfirming] = useState(false);
	const t = useTranslations("settings.acts");
	const common = useTranslations("settings.common");
	const { mad } = useFormat();

	const run = async (kind: "toggle" | "delete", call: () => Promise<string>) => {
		setPending(kind);
		try {
			toast.success(await call());
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : common("error"));
		} finally {
			setPending(null);
			setConfirming(false);
		}
	};
	const toggle = () =>
		run("toggle", async () => {
			await api(`/acts/${act.id}/${act.active ? "archive" : "restore"}`, { method: "POST" });
			return t(act.active ? "archivedDone" : "restoredDone", { name: act.name });
		});
	const remove = () =>
		run("delete", async () => {
			const res = await api<{ deleted: boolean }>(`/acts/${act.id}`, { method: "DELETE" });
			return t(res.deleted ? "deletedDone" : "keptArchived", { name: act.name });
		});

	return (
		<TableRow>
			<TableCell className={act.active ? "font-medium" : "text-muted-foreground"}>
				<span className="flex items-center gap-2.5">
					<Swatch color={act.color} label={colorName(t, act.color)} />
					<span className="line-clamp-2">{act.name}</span>
				</span>
			</TableCell>
			<TableCell className="w-36">{act.abbreviation && <Abbreviation>{act.abbreviation}</Abbreviation>}</TableCell>
			<TableCell className="w-36 text-end tabular-nums">{mad(act.price)}</TableCell>
			<TableCell className="w-28">
				<span className="flex justify-end gap-1">
					{onEdit && (
						<Button variant="ghost" size="icon" className="size-8" aria-label={t("editLabel", { name: act.name })} onClick={onEdit}>
							<IconEdit />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="text-muted-foreground size-8"
						disabled={!!pending}
						aria-label={t(act.active ? "archiveLabel" : "restoreLabel", { name: act.name })}
						title={act.active ? t("archive") : t("restore")}
						onClick={toggle}
					>
						{pending === "toggle" ? <IconSpinner className="animate-spin" /> : act.active ? <IconArchive /> : <IconRestore />}
					</Button>
					{confirming ? (
						<Button variant="destructive" size="sm" className="h-8" disabled={!!pending} onClick={remove} onBlur={() => setConfirming(false)}>
							{pending === "delete" ? <IconSpinner className="animate-spin" /> : <IconTrash />} {t("confirmDelete")}
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="text-destructive hover:text-destructive size-8"
							disabled={!!pending}
							aria-label={t("deleteLabel", { name: act.name })}
							title={t("delete")}
							onClick={() => setConfirming(true)}
						>
							<IconTrash />
						</Button>
					)}
				</span>
			</TableCell>
		</TableRow>
	);
}

function ActForm({ act, onDone }: { act?: Act; onDone: () => void }) {
	const router = useRouter();
	const [name, setName] = useState(act?.name ?? "");
	const [abbreviation, setAbbreviation] = useState(act?.abbreviation ?? "");
	// A new act without a choice gets the least-used colour from the API.
	const [color, setColor] = useState<ActColor | null>(act?.color ?? null);
	const [price, setPrice] = useState(act ? toInput(act.price) : "");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const t = useTranslations("settings.acts");
	const common = useTranslations("settings.common");

	const save = async () => {
		const value = parseMad(price);
		if (name.trim().length < 2) return setError(t("nameError"));
		if (value === null) return setError(t("priceError"));
		setSaving(true);
		setError(null);
		try {
			await api(act ? `/acts/${act.id}` : "/acts", {
				method: act ? "PUT" : "POST",
				body: JSON.stringify({ name, abbreviation: abbreviation.trim() || null, price: value, ...(color && { color }) }),
			});
			toast.success(act ? t("saved") : t("added", { name: name.trim() }));
			onDone();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : common("saveError"));
		} finally {
			setSaving(false);
		}
	};
	// A row can't hold a <form>: Enter saves, Escape cancels.
	const keys = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void save();
		}
		if (e.key === "Escape") onDone();
	};

	return (
		<TableRow className="bg-muted/30 hover:bg-muted/30">
			<TableCell className="align-top">
				<div className="flex items-center gap-2">
					<ColorPicker value={color} onChange={setColor} />
					<Input
					autoFocus
					value={name}
					maxLength={120}
					placeholder={t("namePlaceholder")}
					aria-label={t("nameLabel")}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={keys}
					className="h-8"
				/>
				</div>
				{error && <p className="text-destructive mt-1.5 text-xs">{error}</p>}
			</TableCell>
			<TableCell className="w-36 align-top">
				<Input
					value={abbreviation}
					maxLength={20}
					placeholder={t("abbreviationPlaceholder")}
					aria-label={t("abbreviationLabel")}
					onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
					onKeyDown={keys}
					className="h-8 font-mono"
				/>
			</TableCell>
			<TableCell className="w-36 align-top">
				<div className="relative">
					<Input
						inputMode="decimal"
						value={price}
						placeholder="250"
						aria-label={t("priceLabel")}
						onChange={(e) => setPrice(e.target.value)}
						onKeyDown={keys}
						className="h-8 pe-11 text-end tabular-nums"
					/>
					<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs">MAD</span>
				</div>
			</TableCell>
			<TableCell className="w-28 align-top">
				<span className="flex justify-end gap-1">
					<Button type="button" variant="ghost" size="icon" className="size-8" aria-label={common("cancel")} onClick={onDone}>
						<IconClose />
					</Button>
					<Button type="button" size="icon" className="size-8" disabled={saving} aria-label={common("save")} onClick={() => void save()}>
						{saving ? <IconSpinner className="animate-spin" /> : <IconCheck />}
					</Button>
				</span>
			</TableCell>
		</TableRow>
	);
}

const isCustom = (color: ActColor) => color.startsWith("#");

/** A colour's name: the palette's ("Bleu"), or "Personnalisée · #14b8a6". */
function colorName(t: ReturnType<typeof useTranslations<"settings.acts">>, color: ActColor) {
	return isCustom(color) ? `${t("colors.custom")} · ${color}` : t(`colors.${color as (typeof ACT_COLORS)[number]}`);
}

/** An act's colour, as a dot. */
function Swatch({ color, label, className }: { color: ActColor; label?: string; className?: string }) {
	const swatch = actSwatch(color);
	return (
		<span
			role={label ? "img" : undefined}
			aria-label={label}
			title={label}
			style={swatch.style}
			className={cn("ring-background size-3 shrink-0 rounded-full ring-2", swatch.className, className)}
		/>
	);
}

/** The act's colour on the agenda: a dot that opens the palette. null: chosen by the API. */
function ColorPicker({ value, onChange }: { value: ActColor | null; onChange: (color: ActColor) => void }) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("settings.acts");
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-8 shrink-0"
					aria-label={value ? t("colorLabel", { color: colorName(t, value) }) : t("colorAuto")}
					title={value ? colorName(t, value) : t("colorAuto")}
				>
					{value ? (
						<Swatch color={value} />
					) : (
						<span className="border-muted-foreground/50 size-3 rounded-full border border-dashed" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-2">
				<p className="text-muted-foreground mb-2 px-0.5 text-xs">{t("colorHint")}</p>
				<div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={t("colorTitle")}>
					{ACT_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							role="radio"
							aria-checked={value === c}
							aria-label={t(`colors.${c}`)}
							title={t(`colors.${c}`)}
							onClick={() => {
								onChange(c);
								setOpen(false);
							}}
							className={cn(
								"focus-visible:ring-ring flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:outline-none",
								value === c && "bg-muted",
							)}
						>
							<span className={cn("flex size-5 items-center justify-center rounded-full text-white", ACT_SWATCHES[c])}>
								{value === c && <IconCheck className="size-3" />}
							</span>
						</button>
					))}
					{/* Any colour: the system's colour chooser. */}
					<label
						title={t("colors.custom")}
						className={cn(
							"focus-within:ring-ring relative flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted focus-within:ring-2",
							value && isCustom(value) && "bg-muted",
						)}
					>
						<span
							className="flex size-5 items-center justify-center rounded-full text-white"
							style={{
								background:
									value && isCustom(value)
										? value
										: "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
							}}
						>
							{value && isCustom(value) && <IconCheck className="size-3" />}
						</span>
						<input
							type="color"
							aria-label={t("colors.custom")}
							value={value && isCustom(value) ? value : "#14b8a6"}
							onChange={(e) => onChange(e.target.value.toLowerCase() as ActColor)}
							className="absolute inset-0 cursor-pointer opacity-0"
						/>
					</label>
				</div>
				<HexInput value={value && isCustom(value) ? value : ""} onChange={onChange} />
			</PopoverContent>
		</Popover>
	);
}

/** The custom colour as a code ("#14b8a6"), typed or pasted. */
function HexInput({ value, onChange }: { value: string; onChange: (color: ActColor) => void }) {
	const t = useTranslations("settings.acts");
	const [text, setText] = useState(value);
	return (
		<label className="mt-2 flex items-center gap-2 border-t px-0.5 pt-2 text-xs">
			<span className="text-muted-foreground shrink-0">{t("colorCode")}</span>
			<Input
				value={text}
				placeholder="#14b8a6"
				maxLength={7}
				dir="ltr"
				onChange={(e) => {
					const next = e.target.value.trim().toLowerCase();
					setText(next);
					const hex = next.startsWith("#") ? next : `#${next}`;
					if (/^#[0-9a-f]{6}$/.test(hex)) onChange(hex as ActColor);
				}}
				className="h-7 w-28 font-mono text-xs"
			/>
		</label>
	);
}
