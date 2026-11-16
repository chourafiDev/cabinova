"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AppIcon, IconHeartPulse, IconNote } from "@/components/icons";
import { RichTextEditor } from "@/components/rich-text-editor";
import { api } from "@/lib/api-client";
import type { PatientFile } from "@/lib/patients";
import { textToHtml } from "@/lib/rich-text";
import { SaveStatus, type SaveState } from "./save-status";

/** Saved this long after the doctor stops typing. */
const AUTOSAVE_MS = 800;

/** The patient's rich-text notes that stay the same at every visit, and where each is saved. */
const NOTES = {
	antecedents: { path: "antecedents", icon: IconHeartPulse, title: "sections.antecedents", hint: "antecedentsHint" },
	permanentNote: { path: "permanent-note", icon: IconNote, title: "sections.permanentNote", hint: "permanentNoteHint" },
} as const satisfies Record<string, { path: string; icon: AppIcon; title: string; hint: string }>;
type NoteField = keyof typeof NOTES;

/** A note written before the editor (plain text) opens as paragraphs. */
const asHtml = (value: string | null | undefined) =>
	!value ? "" : value.trimStart().startsWith("<") ? value : textToHtml(value);

/**
 * One rich-text note on the patient, the same at every visit, saved as the
 * doctor types: the antécédents, or the permanent note (also shown in the
 * header's alerts).
 */
export function PatientNoteCard({ patient, field }: { patient: PatientFile; field: NoteField }) {
	const t = useTranslations("dossier");
	const queryClient = useQueryClient();
	const note = NOTES[field];
	const initial = asHtml(patient.medicalProfile?.[field]);
	const [value, setValue] = useState(initial);
	const [state, setState] = useState<SaveState>({ status: "idle" });
	const saved = useRef(initial);
	const latest = useRef(initial);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const save = useCallback(async () => {
		const html = latest.current;
		if (html === saved.current) return;
		setState({ status: "saving" });
		try {
			const result = await api<Record<NoteField, string | null> & { updatedAt: string }>(
				`/patients/${patient.id}/${note.path}`,
				{ method: "PUT", body: JSON.stringify({ [field]: html }) },
			);
			saved.current = html;
			setState({ status: "saved", at: result.updatedAt });
			// The cached file follows (a first note creates the profile: refetched instead).
			if (patient.medicalProfile) {
				queryClient.setQueryData<PatientFile>(["patient", patient.id], (p) =>
					p?.medicalProfile ? { ...p, medicalProfile: { ...p.medicalProfile, [field]: result[field] } } : p,
				);
			} else void queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
		} catch {
			setState({ status: "error" });
		}
	}, [field, note.path, patient.id, patient.medicalProfile, queryClient]);

	// Leaving the page: what was typed is still sent.
	useEffect(
		() => () => {
			if (timer.current) {
				clearTimeout(timer.current);
				void save();
			}
		},
		[save],
	);

	const change = (html: string) => {
		setValue(html);
		latest.current = html;
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			timer.current = null;
			void save();
		}, AUTOSAVE_MS);
	};

	const Icon = note.icon;
	return (
		<section className="bg-card rounded-xl border">
			<header className="flex items-center gap-2 px-4 pt-4 pb-3">
				<span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
					<Icon className="size-4" />
				</span>
				<h2 className="text-sm font-semibold">{t(note.title)}</h2>
				<span className="ms-auto">
					<SaveStatus state={state} />
				</span>
			</header>
			<div className="grid gap-1.5 px-4 pb-4">
				<RichTextEditor
					id={`patient-${field}`}
					value={value}
					onChange={change}
					minHeight={field === "permanentNote" ? "min-h-20" : "min-h-32"}
				/>
				<p className="text-muted-foreground text-xs">{t(note.hint)}</p>
			</div>
		</section>
	);
}
