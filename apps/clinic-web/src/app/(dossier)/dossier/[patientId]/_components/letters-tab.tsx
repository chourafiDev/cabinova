"use client";

import { moroccoDay } from "@cabinova/morocco-time";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { IconCheck, IconChevronsUpDown, IconDocument, IconEdit, IconHistory, IconMail, IconPlus, IconPrinter, IconSave, IconSpinner } from "@/components/icons";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { fillBlanks } from "@/lib/certificates";
import { LETTER_EXAMPLES, type LetterExample } from "@/lib/letter-catalog";
import { type Letter, type LetterKind, lettersKey } from "@/lib/letters";
import type { PatientFile } from "@/lib/patients";
import { hasText, RICH_TEXT } from "@/lib/rich-text";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { Card } from "./patient-aside";
import { PrintLink, usePrintDialog } from "@/components/print-dialog";

/**
 * Lettres (to a colleague, a hospital, an employer) and Comptes rendus,
 * the same way: written in the rich editor, saved, printed on the
 * letterhead. Below, the patient's ones of that kind, to reprint or correct.
 */
export function LettersTab({
	patient,
	appointmentId,
	kind = "letter",
	onUnsavedChange,
}: {
	patient: PatientFile;
	appointmentId: string | null;
	kind?: LetterKind;
	/** Tells the dossier's tab bar whether text is waiting to be saved (its dot). */
	onUnsavedChange?: (unsaved: boolean) => void;
}) {
	const t = useTranslations(kind === "report" ? "dossier.reports" : "dossier.letters");
	const queryClient = useQueryClient();
	const openPrint = usePrintDialog();
	const [body, setBody] = useState("");
	// The letter saved (or opened) in this form, and its text then: Enregistrer again corrects it.
	const [saved, setSaved] = useState<{ id: string; body: string } | null>(null);
	const [busy, setBusy] = useState<"save" | "print" | null>(null);
	const dirty = !saved || saved.body !== body;
	const archived = patient.archivedAt !== null;
	// Written but not saved (or changed since): the tab shows a dot.
	const unsaved = hasText(body) && dirty;
	useEffect(() => onUnsavedChange?.(unsaved), [unsaved, onUnsavedChange]);
	const user = useCurrentUser();
	const [example, setExample] = useState<string | null>(null);

	/** An example as the text, its blanks filled; what was written can be brought back. */
	const applyExample = (picked: LetterExample) => {
		const before = body;
		const today = moroccoDay();
		setBody(fillBlanks(picked.body, { patient, doctor: user.name, kind: "day", startsOn: today, endsOn: today }));
		setExample(picked.key);
		if (hasText(before)) {
			toast(t("exampleApplied", { name: picked.name }), {
				action: { label: t("undo"), onClick: () => setBody(before) },
			});
		}
	};

	/** Saves (or corrects) the letter; its id, or null when it couldn't be. */
	const save = async (): Promise<string | null> => {
		if (!hasText(body)) {
			toast.error(t("empty"));
			return null;
		}
		if (saved && !dirty) return saved.id;
		const letter = await api<Letter>(saved ? `/letters/${saved.id}` : "/letters", {
			method: saved ? "PUT" : "POST",
			body: JSON.stringify(saved ? { body } : { patientId: patient.id, appointmentId, kind, body }),
		});
		setSaved({ id: letter.id, body });
		void queryClient.invalidateQueries({ queryKey: lettersKey(patient.id, kind) });
		return letter.id;
	};

	const run = async (kind: "save" | "print") => {
		setBusy(kind);
		try {
			const id = await save();
			if (!id) return;
			if (kind === "print") openPrint(`/lettres/${id}`);
			else toast.success(t("saved"));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setBusy(null);
		}
	};

	/** A past letter, opened to correct it (Enregistrer updates that one). */
	const open = (letter: Letter) => {
		setBody(letter.body);
		setSaved({ id: letter.id, body: letter.body });
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const reset = () => {
		setBody("");
		setSaved(null);
		setExample(null);
	};

	return (
		<div className="grid gap-4">
			<Card
				icon={kind === "report" ? IconDocument : IconMail}
				title={saved ? t("editing") : t("title")}
				aside={
					saved && (
						<Button type="button" variant="ghost" size="sm" className="h-7 font-normal" onClick={reset}>
							<IconPlus /> {t("new")}
						</Button>
					)
				}
			>
				<div className="grid gap-3">
					<ExamplePicker kind={kind} current={example} onPick={applyExample} />
					<RichTextEditor id={`${kind}-text`} value={body} onChange={setBody} minHeight="min-h-64" />
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

			<LettersHistory patientId={patient.id} kind={kind} current={saved?.id ?? null} onOpen={open} />
		</div>
	);
}

/** The patient's letters: reprint, or open one to correct it. */
function LettersHistory({
	patientId,
	kind,
	current,
	onOpen,
}: {
	patientId: string;
	kind: LetterKind;
	/** The letter open in the form, marked in the list. */
	current: string | null;
	onOpen: (letter: Letter) => void;
}) {
	const t = useTranslations(kind === "report" ? "dossier.reports" : "dossier.letters");
	const format = useFormat();
	const history = useQuery({
		queryKey: lettersKey(patientId, kind),
		queryFn: () => api<Letter[]>(`/letters?patientId=${patientId}&kind=${kind}`),
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
					{history.data.map((l) => (
						<li key={l.id} className={cn("rounded-lg border", l.id === current && "border-primary")}>
							<div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
								<p className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
									{format.date(l.createdAt, { weekday: "short", month: "short" })}
									{l.practitioner && <span className="text-muted-foreground font-normal"> · {l.practitioner}</span>}
								</p>
								<Button type="button" variant="ghost" size="sm" className="h-7 font-normal" onClick={() => onOpen(l)}>
									<IconEdit /> {t("open")}
								</Button>
								<Button asChild variant="outline" size="sm" className="h-7">
									<PrintLink href={`/lettres/${l.id}`}>
										<IconPrinter /> {t("reprint")}
									</PrintLink>
								</Button>
							</div>
							{/* Cleaned by the API (only the editor's formatting is kept). */}
							<div
								className={cn("line-clamp-4 px-3 py-2 text-sm", RICH_TEXT)}
								dangerouslySetInnerHTML={{ __html: l.body }}
							/>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

/** Cabinova's examples of this kind, searched by name or other words, to start from. */
function ExamplePicker({
	kind,
	current,
	onPick,
}: {
	kind: LetterKind;
	current: string | null;
	onPick: (example: LetterExample) => void;
}) {
	const t = useTranslations(kind === "report" ? "dossier.reports" : "dossier.letters");
	const [open, setOpen] = useState(false);
	const examples = LETTER_EXAMPLES.filter((e) => e.kind === kind);
	const chosen = examples.find((e) => e.key === current);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={t("examples")}
					className="h-9 w-full justify-between font-normal sm:w-96"
				>
					<span className={cn("truncate", !chosen && "text-muted-foreground")}>{chosen?.name ?? t("examplePlaceholder")}</span>
					<IconChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
				<Command>
					<CommandInput placeholder={t("exampleSearch")} />
					<CommandList className="max-h-80">
						<CommandEmpty>{t("exampleEmpty")}</CommandEmpty>
						<CommandGroup heading={t("examples")}>
							{examples.map((e) => (
								<CommandItem
									key={e.key}
									value={e.key}
									keywords={[e.name, e.keywords]}
									onSelect={() => {
										onPick(e);
										setOpen(false);
									}}
								>
									<span className="min-w-0 flex-1 truncate">{e.name}</span>
									<IconCheck className={cn("size-4", current === e.key ? "opacity-100" : "opacity-0")} />
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
