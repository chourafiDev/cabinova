"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuArchive, LuArchiveRestore, LuCheck, LuLoader, LuPencil, LuPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { type Act, parseMad, toInput } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { SettingsCard } from "../../_components/settings-card";

/** Tarifs: acts and their price; archived ones stay on past visits. */
export function ActsManager({ acts }: { acts: Act[] }) {
	const [editing, setEditing] = useState<string | "new" | null>(acts.length === 0 ? "new" : null);
	const t = useTranslations("settings.acts");
	const active = acts.filter((a) => a.active);
	const archived = acts.filter((a) => !a.active);

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
				<ul className="divide-y rounded-lg border">
					{editing === "new" && <ActForm onDone={() => setEditing(null)} />}
					{active.map((a) =>
						editing === a.id ? (
							<ActForm key={a.id} act={a} onDone={() => setEditing(null)} />
						) : (
							<ActRow key={a.id} act={a} onEdit={() => setEditing(a.id)} />
						),
					)}
					{active.length === 0 && editing !== "new" && (
						<li className="text-muted-foreground px-3 py-6 text-center text-sm">
							{t("empty")}
						</li>
					)}
				</ul>
			</SettingsCard>
			{archived.length > 0 && (
				<SettingsCard title={t("archivedTitle")} description={t("archivedHint")}>
					<ul className="divide-y rounded-lg border">
						{archived.map((a) => (
							<ActRow key={a.id} act={a} />
						))}
					</ul>
				</SettingsCard>
			)}
		</>
	);
}

function ActRow({ act, onEdit }: { act: Act; onEdit?: () => void }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const t = useTranslations("settings.acts");
	const common = useTranslations("settings.common");
	const { mad } = useFormat();
	const toggle = async () => {
		setPending(true);
		try {
			await api(`/acts/${act.id}/${act.active ? "archive" : "restore"}`, { method: "POST" });
			toast.success(t(act.active ? "archivedDone" : "restoredDone", { name: act.name }));
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : common("error"));
		} finally {
			setPending(false);
		}
	};
	return (
		<li className="flex items-center gap-3 px-3 py-2.5">
			<span className={act.active ? "min-w-0 flex-1 truncate text-sm font-medium" : "text-muted-foreground min-w-0 flex-1 truncate text-sm"}>
				{act.name}
			</span>
			<span className="text-sm tabular-nums">{mad(act.price)}</span>
			<span className="flex gap-1">
				{onEdit && (
					<Button variant="ghost" size="icon" className="size-8" aria-label={t("editLabel", { name: act.name })} onClick={onEdit}>
						<LuPencil />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="text-muted-foreground size-8"
					disabled={pending}
					aria-label={t(act.active ? "archiveLabel" : "restoreLabel", { name: act.name })}
					title={act.active ? t("archive") : t("restore")}
					onClick={toggle}
				>
					{pending ? <LuLoader className="animate-spin" /> : act.active ? <LuArchive /> : <LuArchiveRestore />}
				</Button>
			</span>
		</li>
	);
}

function ActForm({ act, onDone }: { act?: Act; onDone: () => void }) {
	const router = useRouter();
	const [name, setName] = useState(act?.name ?? "");
	const [price, setPrice] = useState(act ? toInput(act.price) : "");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const t = useTranslations("settings.acts");
	const common = useTranslations("settings.common");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		const value = parseMad(price);
		if (name.trim().length < 2) return setError(t("nameError"));
		if (value === null) return setError(t("priceError"));
		setSaving(true);
		setError(null);
		try {
			await api(act ? `/acts/${act.id}` : "/acts", {
				method: act ? "PUT" : "POST",
				body: JSON.stringify({ name, price: value }),
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

	return (
		<li className="bg-muted/30 px-3 py-2.5">
			<form onSubmit={save} className="grid gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<Input
						autoFocus
						value={name}
						maxLength={120}
						placeholder={t("namePlaceholder")}
						aria-label={t("nameLabel")}
						onChange={(e) => setName(e.target.value)}
						className="h-8 min-w-40 flex-1"
					/>
					<div className="relative w-32">
						<Input
							inputMode="decimal"
							value={price}
							placeholder="250"
							aria-label={t("priceLabel")}
							onChange={(e) => setPrice(e.target.value)}
							className="h-8 pe-11 text-end tabular-nums"
						/>
						<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs">MAD</span>
					</div>
					<Button type="button" variant="ghost" size="icon" className="size-8" aria-label={common("cancel")} onClick={onDone}>
						<LuX />
					</Button>
					<Button type="submit" size="icon" className="size-8" disabled={saving} aria-label={common("save")}>
						{saving ? <LuLoader className="animate-spin" /> : <LuCheck />}
					</Button>
				</div>
				{error && <p className="text-destructive text-xs">{error}</p>}
			</form>
		</li>
	);
}
