"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import {
	IconBookmarkAdd,
	IconEdit,
	IconHistory,
	IconPill,
	IconPlus,
	IconPrinter,
	IconReset,
	IconStar,
	IconTrash,
	IconWarning,
} from "@/components/icons";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	MEDICATION_FAVORITES_KEY,
	type MedicationSuggestion,
	type RenewalWarning,
} from "@/lib/medications";
import {
	composePrescription,
	type ItemDraft,
	type KnownMedication,
	newItem,
	type PastPrescription,
	type Prescription,
	toItems,
} from "@/lib/prescriptions";
import { hasText } from "@/lib/rich-text";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { type MedicationPick, MedicationInput } from "./medication-input";
import type { SaveState } from "./save-status";
import type { WorkspaceHandle } from "./consultation-workspace";
import { usePrintDialog } from "@/components/print-dialog";

/** What the dossier can do with the ordonnance being written. */
export type PrescriptionHandle = WorkspaceHandle & { renew: () => void };

const AUTOSAVE_MS = 800;
const MEDICATIONS_KEY = ["prescription-medications"] as const;

/** `body`: the ordonnance as the doctor reworded it in the editor; null while it follows the lines. */
type Draft = { items: ItemDraft[]; notes: string; body: string | null };

const toDraft = (p: Prescription | null): Draft => ({
	items: p?.items.length ? p.items.map((i) => newItem(i)) : [newItem()],
	notes: p?.notes ?? "",
	body: p?.body ?? null,
});
/** What is compared and sent: the lines without their keys, and the reworded text if any. */
const toBody = (d: Draft) => ({
	items: toItems(d.items),
	notes: d.notes.trim() || null,
	body: d.body !== null && hasText(d.body) ? d.body : null,
});
/** The text the editor shows while it follows the lines. */
const composed = (d: Draft) => composePrescription(toItems(d.items), d.notes.trim() || null);

/**
 * Today's ordonnance: one line per medication (posology, duration), picked
 * from the AMMPS list, the doctor's own medicines or what they prescribed
 * before (their usual posology filled in), last visit's ordonnance renewed
 * in one click — with a warning on what has been withdrawn since. Saved as the doctor types, printed on the
 * cabinet's letterhead.
 */
export function PrescriptionEditor({
	ref,
	appointmentId,
	prescription,
	previous,
	onSaveState,
}: {
	ref: React.Ref<PrescriptionHandle>;
	appointmentId: string;
	prescription: Prescription | null;
	/** The patient's last ordonnance from another visit, to renew. */
	previous: PastPrescription | undefined;
	onSaveState: (state: SaveState) => void;
}) {
	const t = useTranslations("dossier.prescription");
	const fmt = useFormat();
	const queryClient = useQueryClient();
	const openPrint = usePrintDialog();
	const [draft, setDraft] = useState<Draft>(() => toDraft(prescription));
	const saved = useRef(JSON.stringify(toBody(toDraft(prescription))));
	const latest = useRef(draft);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlight = useRef<Promise<boolean> | null>(null);
	const known = useQuery({ queryKey: MEDICATIONS_KEY, queryFn: () => api<KnownMedication[]>("/prescriptions/medications") });
	const favorites = useQuery({
		queryKey: MEDICATION_FAVORITES_KEY,
		queryFn: () => api<MedicationSuggestion[]>("/medications/favorites"),
	});

	const save = useCallback(async (): Promise<boolean> => {
		if (inFlight.current) await inFlight.current;
		const body = toBody(latest.current);
		const json = JSON.stringify(body);
		if (json === saved.current) return true;
		onSaveState({ status: "saving" });
		const request = api<Prescription>(`/prescriptions/visit/${appointmentId}`, {
			method: "PUT",
			body: JSON.stringify(body),
		})
			.then((result) => {
				saved.current = json;
				onSaveState({ status: "saved", at: result.updatedAt });
				queryClient.setQueryData(["prescription-visit", appointmentId], result);
				void queryClient.invalidateQueries({ queryKey: MEDICATIONS_KEY });
				return true;
			})
			.catch(() => {
				onSaveState({ status: "error" });
				return false;
			})
			.finally(() => {
				inFlight.current = null;
			});
		inFlight.current = request;
		return request;
	}, [appointmentId, onSaveState, queryClient]);

	const flush = useCallback(async () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		return save();
	}, [save]);

	const update = (next: (d: Draft) => Draft) => {
		setDraft((d) => {
			const value = next(d);
			latest.current = value;
			return value;
		});
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
	};

	const setItem = (key: string, patch: Partial<ItemDraft>) =>
		update((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

	const focusMedication = (key: string) => requestAnimationFrame(() => document.getElementById(`rx-${key}`)?.focus());
	// Right away (the field is already there): what is typed next goes to the posology.
	const focusPosology = (key: string) => document.getElementById(`rx-${key}-posology`)?.focus();

	const addLine = () => {
		const item = newItem();
		update((d) => ({ ...d, items: [...d.items, item] }));
		focusMedication(item.key);
	};

	const removeLine = (key: string) =>
		update((d) => {
			const items = d.items.filter((i) => i.key !== key);
			return { ...d, items: items.length ? items : [newItem()] };
		});

	/**
	 * Last visit's lines come after what's written (empty lines replaced).
	 * Lines whose medicine has been withdrawn since are kept, flagged: the
	 * doctor decides.
	 */
	const renew = async () => {
		if (!previous) return;
		let warnings: RenewalWarning[] = [];
		if (previous.items.some((i) => i.ammpsId || i.customMedicationId)) {
			try {
				({ warnings } = await api<{ warnings: RenewalWarning[] }>("/medications/check-renewal", {
					method: "POST",
					// Only what the check reads (the API refuses other fields).
					body: JSON.stringify({
						items: previous.items.map(({ medication, ammpsId, customMedicationId }) => ({
							medication,
							ammpsId: ammpsId ?? null,
							customMedicationId: customMedicationId ?? null,
						})),
					}),
				}));
			} catch {
				// Renewed without the check rather than not at all.
			}
		}
		const flagged = new Map(warnings.map((w) => [w.index, w.reason]));
		update((d) => ({
			...d,
			items: [
				...d.items.filter((i) => i.medication.trim()),
				...previous.items.map((i, index) => ({ ...newItem(i), warning: flagged.get(index) })),
			],
			notes: d.notes.trim() ? d.notes : (previous.notes ?? ""),
		}));
		toast.success(t("renewed", { count: previous.items.length, date: fmt.date(previous.date) }));
		if (warnings.length) toast.warning(t("renewWarnings", { count: warnings.length }), { duration: 8000 });
	};

	/** A suggestion picked: its printed label, where it comes from, and the usual posology unless one is typed. */
	const pickMedication = async (item: ItemDraft, pick: MedicationPick) => {
		if (pick.kind === "suggestion") {
			const s = pick.suggestion;
			setItem(item.key, {
				medication: s.label,
				ammpsId: s.ammpsId,
				customMedicationId: s.customMedicationId,
				warning: undefined,
				posology: item.posology || s.defaultPosology || "",
				duration: item.duration || s.defaultDuration || "",
			});
		} else if (pick.kind === "past") {
			const m = pick.medication;
			setItem(item.key, {
				medication: m.medication,
				ammpsId: m.ammpsId ?? null,
				customMedicationId: m.customMedicationId ?? null,
				warning: undefined,
				posology: item.posology || m.posology || "",
				duration: item.duration || m.duration || "",
			});
		} else {
			// A name typed by hand joins the doctor's own medicines, then fills the line.
			try {
				const created = await api<{ id: string; name: string }>("/medications/custom", {
					method: "POST",
					body: JSON.stringify({ name: pick.name }),
				});
				setItem(item.key, { medication: created.name, ammpsId: null, customMedicationId: created.id, warning: undefined });
				toast.success(t("created", { name: created.name }));
				void queryClient.invalidateQueries({ queryKey: ["medications-search"] });
			} catch (err) {
				toast.error(err instanceof Error ? err.message : t("actionError"));
			}
		}
		focusPosology(item.key);
	};

	const isFavorite = (item: ItemDraft) =>
		(favorites.data ?? []).some(
			(f) =>
				(item.ammpsId !== null && f.ammpsId === item.ammpsId) ||
				(item.customMedicationId !== null && f.customMedicationId === item.customMedicationId),
		);

	/** Saves on the medicine itself (AMMPS override or own medicine): favorite, usual posology. */
	const saveOnMedicine = async (item: ItemDraft, patch: Record<string, unknown>, done: string) => {
		const path =
			item.ammpsId !== null
				? `/medications/ammps/${item.ammpsId}/override`
				: `/medications/custom/${item.customMedicationId}`;
		try {
			await api(path, { method: item.ammpsId !== null ? "PUT" : "PATCH", body: JSON.stringify(patch) });
			toast.success(done);
			void queryClient.invalidateQueries({ queryKey: MEDICATION_FAVORITES_KEY });
			void queryClient.invalidateQueries({ queryKey: ["medications-search"] });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("actionError"));
		}
	};

	// The dossier saves through it, and its header renews the last ordonnance with it.
	useImperativeHandle(ref, () => ({ flush, renew: () => void renew() }));

	const print = async () => {
		// The last keystrokes are saved before the print page reads them.
		if (!(await flush())) {
			toast.error(t("saveFirst"));
			return;
		}
		openPrint(`/ordonnances/${appointmentId}`);
	};

	// Leaving with unsaved lines: the browser asks first; in the app, they're still sent.
	useEffect(() => {
		const onUnload = (e: BeforeUnloadEvent) => {
			if (JSON.stringify(toBody(latest.current)) !== saved.current) e.preventDefault();
		};
		window.addEventListener("beforeunload", onUnload);
		return () => {
			window.removeEventListener("beforeunload", onUnload);
			if (timer.current) {
				clearTimeout(timer.current);
				void save();
			}
		};
	}, [save]);

	const filled = toItems(draft.items).length;
	const printable = filled > 0 || hasText(draft.body);
	// The lines' text when the doctor started rewording it: once they differ, the editor says so.
	const [basis, setBasis] = useState<string | null>(() => (draft.body !== null ? composed(draft) : null));
	const linesChanged = draft.body !== null && basis !== null && basis !== composed(draft);

	return (
		<section className="bg-card rounded-xl border">
			<header className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
				<span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
					<IconPill className="size-4" />
				</span>
				<h2 className="text-sm font-semibold">{t("title")}</h2>
				<div className="ms-auto flex flex-wrap items-center gap-2">
					{previous && (
						<Button type="button" variant="outline" size="sm" onClick={() => void renew()}>
							<IconHistory /> {t("renew", { date: fmt.date(previous.date, { day: "numeric", month: "short" }) })}
						</Button>
					)}
					<Button type="button" size="sm" onClick={() => void print()} disabled={!printable}>
						<IconPrinter /> {t("print")}
					</Button>
				</div>
			</header>

			<div className="grid gap-4 px-4 pb-4">
				<ol className="grid gap-2">
					{draft.items.map((item, index) => (
						<li key={item.key} className="bg-muted/30 grid gap-2 rounded-lg border p-3">
							<div className="flex items-start gap-2">
								<span className="bg-background text-muted-foreground mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums">
									{index + 1}
								</span>
								<MedicationInput
									id={`rx-${item.key}`}
									value={item.medication}
									known={known.data ?? []}
									placeholder={t("placeholders.medication")}
									// Edited by hand: the line no longer is the medicine it was picked as.
									onChange={(medication) =>
										setItem(item.key, { medication, ammpsId: null, customMedicationId: null, warning: undefined })
									}
									onPick={(pick) => void pickMedication(item, pick)}
								/>
								{(item.ammpsId !== null || item.customMedicationId !== null) && (
									<LineActions
										favorite={isFavorite(item)}
										canRemember={!!(item.posology.trim() || item.duration.trim())}
										onFavorite={() =>
											void saveOnMedicine(
												item,
												{ isFavorite: !isFavorite(item) },
												isFavorite(item) ? t("unfavorited") : t("favorited"),
											)
										}
										onRemember={() =>
											void saveOnMedicine(
												item,
												{ defaultPosology: item.posology.trim() || null, defaultDuration: item.duration.trim() || null },
												t("remembered"),
											)
										}
									/>
								)}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-destructive shrink-0"
									aria-label={t("remove")}
									onClick={() => removeLine(item.key)}
								>
									<IconTrash />
								</Button>
							</div>
							{item.warning && (
								<p className="ms-8 flex w-fit items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
									<IconWarning className="size-3.5 shrink-0" /> {t(`warnings.${item.warning}`)}
								</p>
							)}
							<div className="grid gap-2 ps-8 pe-11 sm:grid-cols-[minmax(0,1fr)_10rem]">
								<Input
									id={`rx-${item.key}-posology`}
									value={item.posology}
									onChange={(e) => setItem(item.key, { posology: e.target.value })}
									placeholder={t("placeholders.posology")}
									aria-label={t("posology")}
									maxLength={300}
								/>
								<Input
									value={item.duration}
									onChange={(e) => setItem(item.key, { duration: e.target.value })}
									onKeyDown={(e) => {
										// Enter on the last line starts the next medication.
										if (e.key === "Enter" && index === draft.items.length - 1) {
											e.preventDefault();
											addLine();
										}
									}}
									placeholder={t("placeholders.duration")}
									aria-label={t("duration")}
									maxLength={100}
								/>
							</div>
						</li>
					))}
				</ol>
				<Button
					type="button"
					variant="outline"
					className="w-full border-dashed"
					onClick={addLine}
					disabled={draft.items.length >= 30}
				>
					<IconPlus /> {t("add")}
				</Button>

				<div className="grid gap-1.5">
					<label htmlFor="rx-notes" className="text-muted-foreground text-xs font-medium">
						{t("notes")}
					</label>
					<Textarea
						id="rx-notes"
						value={draft.notes}
						onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
						placeholder={t("placeholders.notes")}
						maxLength={2000}
						className="field-sizing-content min-h-16 resize-none leading-relaxed"
					/>
				</div>

				{/* The whole ordonnance as it will be printed, free to reword before printing. */}
				<div className="grid gap-2 border-t pt-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="grid">
							<label htmlFor="rx-body" className="flex items-center gap-1.5 text-sm font-semibold">
								<IconEdit className="text-muted-foreground size-4" /> {t("editor.title")}
							</label>
							<p className="text-muted-foreground text-xs">
								{draft.body === null ? t("editor.hint") : t("editor.edited")}
							</p>
						</div>
						{draft.body !== null && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 font-normal"
								onClick={() => {
									setBasis(null);
									update((d) => ({ ...d, body: null }));
								}}
							>
								<IconReset /> {t("editor.regenerate")}
							</Button>
						)}
					</div>
					{linesChanged && (
						<p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
							<IconWarning className="size-3.5 shrink-0" /> {t("editor.linesChanged")}
						</p>
					)}
					<RichTextEditor
						id="rx-body"
						value={draft.body ?? composed(draft)}
						onChange={(html) => {
							// The first change: what the lines said then, to notice later changes.
							if (draft.body === null) setBasis(composed(latest.current));
							update((d) => ({ ...d, body: html }));
						}}
						minHeight="min-h-40"
					/>
				</div>
			</div>
		</section>
	);
}

/** On a line picked from the suggestions: favorite it, or keep its posology as the usual one. */
function LineActions({
	favorite,
	canRemember,
	onFavorite,
	onRemember,
}: {
	favorite: boolean;
	canRemember: boolean;
	onFavorite: () => void;
	onRemember: () => void;
}) {
	const t = useTranslations("dossier.prescription");
	return (
		<div className="flex shrink-0 items-center">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-pressed={favorite}
						aria-label={favorite ? t("unfavorite") : t("favorite")}
						onClick={onFavorite}
						className={cn(favorite ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground")}
					>
						<IconStar />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{favorite ? t("unfavorite") : t("favorite")}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("remember")}
						disabled={!canRemember}
						onClick={onRemember}
						className="text-muted-foreground"
					>
						<IconBookmarkAdd />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("remember")}</TooltipContent>
			</Tooltip>
		</div>
	);
}
