"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	IconCheck,
	IconChevronsUpDown,
	IconClose,
	IconHistory,
	IconLab,
	IconPlus,
	IconPrinter,
	IconReset,
	IconSave,
	IconSettings,
	IconSpinner,
} from "@/components/icons";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import {
	BUILT_IN_BILANS,
	composeBody,
	joinLists,
	LAB_MODELS_KEY,
	type LabRequest,
	type LabRequestModel,
	labRequestsKey,
	type PickedBilan,
	pickedKey,
} from "@/lib/lab-requests";
import type { PatientFile } from "@/lib/patients";
import { hasText, RICH_TEXT } from "@/lib/rich-text";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { LabModelsSheet } from "./lab-request-models";
import { Card } from "./patient-aside";
import { PrintLink, usePrintDialog } from "@/components/print-dialog";

/**
 * Bilan biologique: the doctor picks one or more bilans (Cabinova's or their
 * own), the text follows the choice until edited by hand; saved, then
 * printed on the letterhead. Below, the patient's bilans.
 */
export function LabRequestTab({
	patient,
	appointmentId,
	onUnsavedChange,
}: {
	patient: PatientFile;
	appointmentId: string | null;
	/** Tells the dossier's tab bar whether text is waiting to be saved (its dot). */
	onUnsavedChange?: (unsaved: boolean) => void;
}) {
	const t = useTranslations("dossier.labRequest");
	const queryClient = useQueryClient();
	const openPrint = usePrintDialog();
	const [picked, setPicked] = useState<PickedBilan[]>([]);
	// Edited by hand: the choice no longer rewrites the text (a new pick is added at the end).
	const [edited, setEdited] = useState(false);
	const [text, setText] = useState("");
	// The bilan saved from this form, and its text then: Enregistrer again corrects it.
	const [saved, setSaved] = useState<{ id: string; body: string } | null>(null);
	const [busy, setBusy] = useState<"save" | "print" | null>(null);
	const [managing, setManaging] = useState(false);

	const models = useQuery({ queryKey: LAB_MODELS_KEY, queryFn: () => api<LabRequestModel[]>("/lab-request-models") });
	const body = edited ? text : composeBody(picked);
	const dirty = !saved || saved.body !== body;
	const archived = patient.archivedAt !== null;
	// Written but not saved (or changed since): the tab shows a dot.
	const unsaved = hasText(body) && dirty;
	useEffect(() => onUnsavedChange?.(unsaved), [unsaved, onUnsavedChange]);

	const toggle = (item: PickedBilan) => {
		const key = pickedKey(item);
		const removing = picked.some((p) => pickedKey(p) === key);
		setPicked((list) => (removing ? list.filter((p) => pickedKey(p) !== key) : [...list, item]));
		// Text written by hand: a new bilan goes at the end; a removed one is left to the doctor.
		if (edited && !removing) setText((current) => joinLists(current + composeBody([item])));
	};

	/** Saves (or corrects) the bilan; its id, or null when it couldn't be. */
	const save = async (): Promise<string | null> => {
		if (!hasText(body)) {
			toast.error(t("empty"));
			return null;
		}
		if (saved && !dirty) return saved.id;
		const request = await api<LabRequest>(saved ? `/lab-requests/${saved.id}` : "/lab-requests", {
			method: saved ? "PUT" : "POST",
			body: JSON.stringify(saved ? { body } : { patientId: patient.id, appointmentId, body }),
		});
		setSaved({ id: request.id, body });
		void queryClient.invalidateQueries({ queryKey: labRequestsKey(patient.id) });
		return request.id;
	};

	const run = async (kind: "save" | "print") => {
		setBusy(kind);
		try {
			const id = await save();
			if (!id) return;
			if (kind === "print") openPrint(`/bilans/${id}`);
			else toast.success(t("saved"));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setBusy(null);
		}
	};

	/** A blank form for another bilan. */
	const reset = () => {
		setPicked([]);
		setEdited(false);
		setText("");
		setSaved(null);
	};

	/** A past bilan as the start of a new one. */
	const reuse = (request: LabRequest) => {
		setPicked([]);
		setText(request.body);
		setEdited(true);
		setSaved(null);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="grid gap-4">
			<Card
				icon={IconLab}
				title={t("title")}
				aside={
					saved && (
						<Button type="button" variant="ghost" size="sm" className="h-7 font-normal" onClick={reset}>
							<IconPlus /> {t("new")}
						</Button>
					)
				}
			>
				<div className="grid gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<BilanPicker picked={picked} models={models.data ?? []} onToggle={toggle} />
						<Button type="button" variant="ghost" size="sm" className="h-9 font-normal" onClick={() => setManaging(true)}>
							<IconSettings /> {t("manage")}
						</Button>
					</div>

					{picked.length > 0 && (
						<ul className="flex flex-wrap gap-1.5" aria-label={t("picked")}>
							{picked.map((p) => (
								<li
									key={pickedKey(p)}
									className="border-primary/30 bg-primary/10 text-primary flex items-center gap-1 rounded-md border py-0.5 ps-2 pe-0.5 text-xs"
								>
									{p.kind === "builtIn" ? p.bilan.name : p.model.name}
									<button
										type="button"
										onClick={() => toggle(p)}
										aria-label={t("remove", { name: p.kind === "builtIn" ? p.bilan.name : p.model.name })}
										className="hover:bg-primary/15 rounded p-0.5"
									>
										<IconClose className="size-3" />
									</button>
								</li>
							))}
						</ul>
					)}

					<RichTextEditor
						id="lab-request-text"
						value={body}
						onChange={(html) => {
							setText(html);
							setEdited(true);
						}}
						minHeight="min-h-48"
					/>
					{edited && picked.length > 0 && (
						<button
							type="button"
							onClick={() => setEdited(false)}
							className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
						>
							<IconReset className="size-3" /> {t("reapply")}
						</button>
					)}

					<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
						<p className="text-muted-foreground text-xs">
							{saved ? (dirty ? t("unsaved") : t("savedHint")) : t("hint")}
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => void run("save")}
								disabled={!!busy || archived || (!!saved && !dirty)}
							>
								{busy === "save" ? <IconSpinner className="animate-spin" /> : <IconSave />} {t("save")}
							</Button>
							<Button type="button" onClick={() => void run("print")} disabled={!!busy || archived}>
								{busy === "print" ? <IconSpinner className="animate-spin" /> : <IconPrinter />} {t("print")}
							</Button>
						</div>
					</div>
				</div>
			</Card>

			<LabRequestHistory patientId={patient.id} onReuse={reuse} />
			<LabModelsSheet open={managing} onOpenChange={setManaging} />
		</div>
	);
}

/** Cabinova's bilans and the doctor's own, several at once; searched by name or other words. */
function BilanPicker({
	picked,
	models,
	onToggle,
}: {
	picked: PickedBilan[];
	models: LabRequestModel[];
	onToggle: (item: PickedBilan) => void;
}) {
	const t = useTranslations("dossier.labRequest");
	const [open, setOpen] = useState(false);
	const chosen = new Set(picked.map(pickedKey));

	const item = (key: string, name: string, onSelect: () => void, keywords?: string[]) => (
		<CommandItem key={key} value={key} keywords={[name, ...(keywords ?? [])]} onSelect={onSelect}>
			<span
				className={cn(
					"flex size-4 shrink-0 items-center justify-center rounded border",
					chosen.has(key) ? "border-primary bg-primary text-primary-foreground" : "border-input",
				)}
			>
				{chosen.has(key) && <IconCheck className="size-3" />}
			</span>
			<span className="min-w-0 flex-1 truncate">{name}</span>
		</CommandItem>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="h-9 min-w-64 flex-1 justify-between font-normal sm:flex-none"
				>
					<span className={cn("truncate", !picked.length && "text-muted-foreground")}>
						{picked.length ? t("pickedCount", { count: picked.length }) : t("choose")}
					</span>
					<IconChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="start">
				<Command>
					<CommandInput placeholder={t("search")} />
					<CommandList className="max-h-80">
						<CommandEmpty>{t("noMatch")}</CommandEmpty>
						{models.length > 0 && (
							<CommandGroup heading={t("mine")}>
								{models.map((m) => item(m.id, m.name, () => onToggle({ kind: "mine", model: m })))}
							</CommandGroup>
						)}
						<CommandGroup heading={t("builtIn")}>
							{BUILT_IN_BILANS.map((b) =>
								item(b.key, b.name, () => onToggle({ kind: "builtIn", bilan: b }), [
									b.keywords ?? "",
									...(b.analyses ?? []),
								]),
							)}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** The patient's bilans: reprint, or start a new one from it. */
function LabRequestHistory({ patientId, onReuse }: { patientId: string; onReuse: (request: LabRequest) => void }) {
	const t = useTranslations("dossier.labRequest");
	const format = useFormat();
	const history = useQuery({
		queryKey: labRequestsKey(patientId),
		queryFn: () => api<LabRequest[]>(`/lab-requests?patientId=${patientId}`),
	});

	return (
		<Card
			icon={IconHistory}
			title={t("history")}
			aside={
				!!history.data?.length && <span className="text-muted-foreground text-xs tabular-nums">{history.data.length}</span>
			}
		>
			{history.isPending ? (
				<Skeleton className="h-16" />
			) : history.isError ? (
				<p className="text-destructive text-sm">{t("loadError")}</p>
			) : !history.data.length ? (
				<p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
			) : (
				<ul className="grid gap-3">
					{history.data.map((r) => (
						<li key={r.id} className="rounded-lg border">
							<div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
								<p className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
									{format.date(r.createdAt, { weekday: "short", month: "short" })}
									{r.practitioner && <span className="text-muted-foreground font-normal"> · {r.practitioner}</span>}
								</p>
								<Button type="button" variant="ghost" size="sm" className="h-7 font-normal" onClick={() => onReuse(r)}>
									<IconReset /> {t("reuse")}
								</Button>
								<Button asChild variant="outline" size="sm" className="h-7">
									<PrintLink href={`/bilans/${r.id}`}>
										<IconPrinter /> {t("reprint")}
									</PrintLink>
								</Button>
							</div>
							{/* Cleaned by the API (only the editor's formatting is kept). */}
							<div
								className={cn("line-clamp-4 px-3 py-2 text-sm", RICH_TEXT)}
								dangerouslySetInnerHTML={{ __html: r.body }}
							/>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
