"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuArchive, LuArchiveRestore, LuCheck, LuLoader, LuPencil, LuPlus, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { Abbreviation } from "@/components/act-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { type Act, parseMad, toInput } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { SettingsCard } from "../../_components/settings-card";

/** "cs" finds Consultation by its abbreviation, "bilan" by its name. */
const matches = (act: Act, search: string) => {
	const q = search.trim().toLowerCase();
	return !q || act.name.toLowerCase().includes(q) || !!act.abbreviation?.toLowerCase().includes(q);
};

/**
 * Tarifs: the price list as a table (libellé, abréviation, montant), searched
 * by name or abbreviation. Archived acts stay on past visits; an act never
 * charged can be deleted for good.
 */
export function ActsManager({ acts }: { acts: Act[] }) {
	const [editing, setEditing] = useState<string | "new" | null>(acts.length === 0 ? "new" : null);
	const [search, setSearch] = useState("");
	const t = useTranslations("settings.acts");
	const active = acts.filter((a) => a.active);
	const shown = active.filter((a) => matches(a, search));
	const archived = acts.filter((a) => !a.active && matches(a, search));

	return (
		<>
			<SettingsCard
				title={t("title")}
				description={t("description")}
				action={
					editing !== "new" && (
						<Button size="sm" onClick={() => setEditing("new")}>
							<LuPlus /> {t("new")}
						</Button>
					)
				}
			>
				<div className="grid gap-3">
					{active.length > 0 && (
						<div className="relative w-full sm:w-80">
							<LuSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
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
				<span className="line-clamp-2">{act.name}</span>
			</TableCell>
			<TableCell className="w-36">{act.abbreviation && <Abbreviation>{act.abbreviation}</Abbreviation>}</TableCell>
			<TableCell className="w-36 text-end tabular-nums">{mad(act.price)}</TableCell>
			<TableCell className="w-28">
				<span className="flex justify-end gap-1">
					{onEdit && (
						<Button variant="ghost" size="icon" className="size-8" aria-label={t("editLabel", { name: act.name })} onClick={onEdit}>
							<LuPencil />
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
						{pending === "toggle" ? <LuLoader className="animate-spin" /> : act.active ? <LuArchive /> : <LuArchiveRestore />}
					</Button>
					{confirming ? (
						<Button variant="destructive" size="sm" className="h-8" disabled={!!pending} onClick={remove} onBlur={() => setConfirming(false)}>
							{pending === "delete" ? <LuLoader className="animate-spin" /> : <LuTrash2 />} {t("confirmDelete")}
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
							<LuTrash2 />
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
				body: JSON.stringify({ name, abbreviation: abbreviation.trim() || null, price: value }),
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
						<LuX />
					</Button>
					<Button type="button" size="icon" className="size-8" disabled={saving} aria-label={common("save")} onClick={() => void save()}>
						{saving ? <LuLoader className="animate-spin" /> : <LuCheck />}
					</Button>
				</span>
			</TableCell>
		</TableRow>
	);
}
