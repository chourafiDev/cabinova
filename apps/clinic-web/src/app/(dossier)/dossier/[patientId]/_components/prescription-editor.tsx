"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { LuHistory, LuPill, LuPlus, LuPrinter, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	type ItemDraft,
	type KnownMedication,
	newItem,
	type PastPrescription,
	type Prescription,
	toItems,
} from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import type { SaveState } from "./save-status";
import type { WorkspaceHandle } from "./consultation-workspace";

const AUTOSAVE_MS = 800;
const MEDICATIONS_KEY = ["prescription-medications"] as const;

type Draft = { items: ItemDraft[]; notes: string };

const toDraft = (p: Prescription | null): Draft => ({
	items: p?.items.length ? p.items.map((i) => newItem(i)) : [newItem()],
	notes: p?.notes ?? "",
});
/** What is compared and sent: the lines without their keys. */
const toBody = (d: Draft) => ({ items: toItems(d.items), notes: d.notes.trim() || null });

/**
 * Today's ordonnance: one line per medication (posology, duration), the
 * doctor's past prescriptions suggested as they type, last visit's
 * ordonnance renewed in one click. Saved as the doctor types, printed on the
 * cabinet's letterhead.
 */
export function PrescriptionEditor({
	ref,
	appointmentId,
	prescription,
	previous,
	onSaveState,
}: {
	ref: React.Ref<WorkspaceHandle>;
	appointmentId: string;
	prescription: Prescription | null;
	/** The patient's last ordonnance from another visit, to renew. */
	previous: PastPrescription | undefined;
	onSaveState: (state: SaveState) => void;
}) {
	const t = useTranslations("dossier.prescription");
	const fmt = useFormat();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [draft, setDraft] = useState<Draft>(() => toDraft(prescription));
	const saved = useRef(JSON.stringify(toBody(toDraft(prescription))));
	const latest = useRef(draft);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlight = useRef<Promise<boolean> | null>(null);
	const known = useQuery({ queryKey: MEDICATIONS_KEY, queryFn: () => api<KnownMedication[]>("/prescriptions/medications") });

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

	useImperativeHandle(ref, () => ({ flush }), [flush]);

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

	/** Last visit's lines come after what's written (empty lines replaced). */
	const renew = () => {
		if (!previous) return;
		update((d) => ({
			items: [...d.items.filter((i) => i.medication.trim()), ...previous.items.map((i) => newItem(i))],
			notes: d.notes.trim() ? d.notes : (previous.notes ?? ""),
		}));
		toast.success(t("renewed", { count: previous.items.length, date: fmt.date(previous.date) }));
	};

	const print = async () => {
		// Opened at once (pop-up blockers), filled once the last keystrokes are saved.
		const tab = window.open("", "_blank");
		if (!(await flush())) {
			tab?.close();
			toast.error(t("saveFirst"));
			return;
		}
		if (tab) tab.location.href = `/ordonnances/${appointmentId}`;
		else router.push(`/ordonnances/${appointmentId}`);
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

	return (
		<section className="bg-card rounded-xl border">
			<header className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
				<span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
					<LuPill className="size-4" />
				</span>
				<h2 className="text-sm font-semibold">{t("title")}</h2>
				<div className="ms-auto flex flex-wrap items-center gap-2">
					{previous && (
						<Button type="button" variant="outline" size="sm" onClick={renew}>
							<LuHistory /> {t("renew", { date: fmt.date(previous.date, { day: "numeric", month: "short" }) })}
						</Button>
					)}
					<Button type="button" size="sm" onClick={() => void print()} disabled={filled === 0}>
						<LuPrinter /> {t("print")}
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
									onChange={(medication) => setItem(item.key, { medication })}
									onPick={(m) =>
										setItem(item.key, {
											medication: m.medication,
											// What the doctor already typed wins over the usual dose.
											posology: item.posology || m.posology || "",
											duration: item.duration || m.duration || "",
										})
									}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-destructive shrink-0"
									aria-label={t("remove")}
									onClick={() => removeLine(item.key)}
								>
									<LuTrash2 />
								</Button>
							</div>
							<div className="grid gap-2 ps-8 pe-11 sm:grid-cols-[minmax(0,1fr)_10rem]">
								<Input
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
					<LuPlus /> {t("add")}
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
			</div>
		</section>
	);
}

/** The medication's name, with what this doctor prescribed before as suggestions. */
function MedicationInput({
	id,
	value,
	known,
	placeholder,
	onChange,
	onPick,
}: {
	id: string;
	value: string;
	known: KnownMedication[];
	placeholder: string;
	onChange: (value: string) => void;
	onPick: (m: KnownMedication) => void;
}) {
	const t = useTranslations("dossier.prescription");
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const query = value.trim().toLowerCase();
	const matches =
		query.length < 2
			? []
			: known
					.filter((m) => m.medication.toLowerCase().includes(query) && m.medication.toLowerCase() !== query)
					.slice(0, 6);
	const shown = open && matches.length > 0;

	const pick = (m: KnownMedication) => {
		onPick(m);
		setOpen(false);
	};

	return (
		<div className="relative min-w-0 flex-1">
			<Input
				id={id}
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
					setActive(0);
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={(e) => {
					if (!shown) return;
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						const step = e.key === "ArrowDown" ? 1 : -1;
						setActive((a) => (a + step + matches.length) % matches.length);
					} else if (e.key === "Enter") {
						e.preventDefault();
						pick(matches[active]);
					} else if (e.key === "Escape") {
						setOpen(false);
					}
				}}
				placeholder={placeholder}
				aria-label={t("medication")}
				role="combobox"
				aria-expanded={shown}
				aria-controls={listId}
				aria-autocomplete="list"
				autoComplete="off"
				maxLength={300}
				className="bg-background font-medium"
			/>
			{shown && (
				<ul
					id={listId}
					role="listbox"
					className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-30 mt-1 grid gap-0.5 rounded-md border p-1 shadow-md"
				>
					{matches.map((m, i) => (
						<li
							key={m.medication}
							role="option"
							aria-selected={i === active}
							// Before the input's blur, or the list is gone.
							onMouseDown={(e) => {
								e.preventDefault();
								pick(m);
							}}
							onMouseEnter={() => setActive(i)}
							className={cn("cursor-pointer rounded px-2 py-1.5 text-sm", i === active && "bg-accent")}
						>
							<p className="font-medium">{m.medication}</p>
							{(m.posology || m.duration) && (
								<p className="text-muted-foreground text-xs">
									{[m.posology, m.duration].filter(Boolean).join(" · ")}
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
