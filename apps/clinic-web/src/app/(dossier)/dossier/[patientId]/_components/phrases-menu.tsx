"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuBookmark, LuBookmarkPlus, LuLoader, LuPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import type { Phrase, PhraseField } from "@/lib/consultations";

const PHRASES_KEY = ["phrases"] as const;

/**
 * The doctor's saved phrases for one field ("Modèles"): one click puts a
 * phrase in the field; what's already written can be saved for next time.
 */
export function PhrasesMenu({
	field,
	value,
	onInsert,
}: {
	field: PhraseField;
	/** What the field holds now (to save it as a phrase). */
	value: string;
	onInsert: (text: string) => void;
}) {
	const t = useTranslations("dossier.phrases");
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const { data } = useQuery({ queryKey: PHRASES_KEY, queryFn: () => api<Phrase[]>("/phrases") });
	const mine = (data ?? []).filter((p) => p.field === field);

	async function save(phrase: string) {
		const clean = phrase.trim();
		if (!clean) return;
		setBusy(true);
		try {
			await api("/phrases", { method: "POST", body: JSON.stringify({ field, text: clean }) });
			toast.success(t("saved"));
			setText("");
			void queryClient.invalidateQueries({ queryKey: PHRASES_KEY });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setBusy(false);
		}
	}

	async function remove(id: string) {
		// Shown gone at once; back if the server refuses.
		const before = queryClient.getQueryData<Phrase[]>(PHRASES_KEY);
		queryClient.setQueryData<Phrase[]>(PHRASES_KEY, (list) => list?.filter((p) => p.id !== id));
		try {
			await api(`/phrases/${id}`, { method: "DELETE" });
		} catch (err) {
			queryClient.setQueryData(PHRASES_KEY, before);
			toast.error(err instanceof Error ? err.message : t("saveError"));
		}
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type="button" variant="ghost" size="sm" className="text-muted-foreground h-7 gap-1.5 px-2 text-xs">
					<LuBookmark className="size-3.5" />
					{t("button")}
					{mine.length > 0 && <span className="bg-muted rounded px-1 tabular-nums">{mine.length}</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0">
				<div className="max-h-64 overflow-y-auto p-1">
					{mine.length === 0 ? (
						<p className="text-muted-foreground px-3 py-4 text-center text-xs">{t("empty")}</p>
					) : (
						mine.map((p) => (
							<div key={p.id} className="hover:bg-accent group flex items-start gap-1 rounded-md">
								<button
									type="button"
									className="min-w-0 flex-1 px-2 py-1.5 text-start text-sm whitespace-pre-line"
									onClick={() => {
										onInsert(p.text);
										setOpen(false);
									}}
								>
									{p.text}
								</button>
								<button
									type="button"
									aria-label={t("remove")}
									className="text-muted-foreground hover:text-destructive mt-1 me-1 rounded p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
									onClick={() => void remove(p.id)}
								>
									<LuX className="size-3.5" />
								</button>
							</div>
						))
					)}
				</div>
				<div className="grid gap-2 border-t p-2">
					<form
						className="flex gap-1.5"
						onSubmit={(e) => {
							e.preventDefault();
							void save(text);
						}}
					>
						<Input
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder={t("newPlaceholder")}
							className="h-8 text-sm"
							maxLength={2000}
						/>
						<Button type="submit" size="icon-sm" variant="outline" aria-label={t("add")} disabled={busy || !text.trim()}>
							{busy ? <LuLoader className="animate-spin" /> : <LuPlus />}
						</Button>
					</form>
					{value.trim() && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							disabled={busy}
							onClick={() => void save(value)}
						>
							<LuBookmarkPlus /> {t("saveCurrent")}
						</Button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
