"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
	LuActivity,
	LuCalendarClock,
	LuClipboardList,
	LuMessageSquareText,
	LuScanSearch,
	LuStethoscope,
} from "react-icons/lu";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	bmiCategory,
	bmiOf,
	type Consultation,
	type ConsultationDraft,
	isAbnormal,
	NOTE_FIELDS,
	type NoteField,
	type PastConsultation,
	type PhraseField,
	toDraft,
	toNumber,
	VITAL_FIELDS,
	type VitalField,
	type Visit,
} from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PhrasesMenu } from "./phrases-menu";
import type { SaveState } from "./save-status";

/** Saved this long after the doctor stops typing. */
const AUTOSAVE_MS = 800;

/** What the API accepts (clinic-api consultations/dto.ts): outside, the field is flagged and nothing is sent. */
const BOUNDS: Record<VitalField, [number, number, number]> = {
	// min, max, decimals
	systolic: [40, 300, 0],
	diastolic: [20, 200, 0],
	heartRate: [20, 250, 0],
	temperature: [30, 45, 1],
	spo2: [50, 100, 0],
	weightKg: [0.5, 400, 1],
	heightCm: [30, 250, 0],
	glycemia: [0.2, 10, 2],
	glycemiaPostprandial: [0.2, 10, 2],
	hba1c: [3, 20, 1],
};

const outOfBounds = (field: VitalField, value: string) => {
	if (value.trim() === "") return false;
	const n = toNumber(value);
	const [min, max, decimals] = BOUNDS[field];
	// 36.6 × 10 is 366.00000000000006 in floating point: compare with a tolerance.
	const scaled = n === null ? 0 : n * 10 ** decimals;
	return n === null || n < min || n > max || Math.abs(Math.round(scaled) - scaled) > 1e-6;
};

export type WorkspaceHandle = { flush: () => Promise<boolean> };

/**
 * Today's consultation, written top to bottom like a paper sheet: motif,
 * constantes, examen, diagnostic, conduite à tenir. Saved as the doctor
 * types; out-of-range constants are flagged, never refused silently.
 */
export function ConsultationWorkspace({
	ref,
	visit,
	previous,
	onSaveState,
}: {
	ref: React.Ref<WorkspaceHandle>;
	visit: Visit;
	previous: PastConsultation | undefined;
	onSaveState: (state: SaveState) => void;
}) {
	const t = useTranslations("dossier");
	const queryClient = useQueryClient();
	const appointmentId = visit.appointment.id;
	const [draft, setDraft] = useState<ConsultationDraft>(() => toDraft(visit.consultation));
	const saved = useRef(JSON.stringify(toDraft(visit.consultation)));
	const latest = useRef(draft);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlight = useRef<Promise<boolean> | null>(null);

	const invalid = VITAL_FIELDS.filter((f) => outOfBounds(f, draft[f]));

	const save = useCallback(async (): Promise<boolean> => {
		if (inFlight.current) await inFlight.current;
		const current = latest.current;
		const json = JSON.stringify(current);
		if (json === saved.current) return true;
		if (VITAL_FIELDS.some((f) => outOfBounds(f, current[f]))) {
			onSaveState({ status: "error" });
			return false;
		}
		onSaveState({ status: "saving" });
		const body = {
			...Object.fromEntries(NOTE_FIELDS.map((f) => [f, current[f]])),
			...Object.fromEntries(VITAL_FIELDS.map((f) => [f, toNumber(current[f])])),
		};
		const request = api<Consultation>(`/consultations/visit/${appointmentId}`, {
			method: "PUT",
			body: JSON.stringify(body),
		})
			.then((result) => {
				saved.current = json;
				onSaveState({ status: "saved", at: result.updatedAt });
				queryClient.setQueryData<Visit>(["consultation-visit", appointmentId], (v) =>
					v ? { ...v, consultation: result } : v,
				);
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

	const change = (field: NoteField | VitalField, value: string) => {
		setDraft((d) => {
			const next = { ...d, [field]: value };
			latest.current = next;
			return next;
		});
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
	};

	// Leaving with unsaved notes: the browser asks first; ⌘S / Ctrl+S saves now.
	useEffect(() => {
		const onUnload = (e: BeforeUnloadEvent) => {
			if (JSON.stringify(latest.current) !== saved.current) e.preventDefault();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				void flush();
			}
		};
		window.addEventListener("beforeunload", onUnload);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("beforeunload", onUnload);
			window.removeEventListener("keydown", onKey);
			// Leaving the page inside the app: what was typed is still sent.
			if (timer.current) {
				clearTimeout(timer.current);
				void save();
			}
		};
	}, [flush, save]);

	/** A saved phrase goes on its own line, after what's written. */
	const insert = (field: PhraseField, text: string) => {
		const current = latest.current[field].trimEnd();
		change(field, current ? `${current}\n${text}` : text);
	};
	const phrases = (field: PhraseField) => (
		<PhrasesMenu field={field} value={draft[field]} onInsert={(text) => insert(field, text)} />
	);

	/** Grows with the text, from a height that says how much is expected. */
	const note = (field: NoteField, minHeight: string, placeholder?: string) => (
		<Textarea
			id={`consultation-${field}`}
			value={draft[field]}
			onChange={(e) => change(field, e.target.value)}
			placeholder={placeholder ?? t(`placeholders.${field}`)}
			maxLength={8000}
			className={cn("field-sizing-content resize-none leading-relaxed", minHeight)}
		/>
	);

	return (
		<div className="grid gap-4">
			<Section icon={LuMessageSquareText} title={t("sections.complaint")}>
				<div className="grid gap-3">
					<Labeled label={t("fields.complaint")} htmlFor="consultation-complaint" aside={phrases("complaint")}>
						{note(
							"complaint",
							"min-h-16",
							visit.appointment.reason
								? t("placeholders.complaintWithAct", { act: visit.appointment.reason })
								: undefined,
						)}
					</Labeled>
					<Labeled label={t("fields.history")} htmlFor="consultation-history" aside={phrases("history")}>
						{note("history", "min-h-24")}
					</Labeled>
				</div>
			</Section>

			<Section
				icon={LuActivity}
				title={t("sections.vitals")}
				aside={invalid.length > 0 && <span className="text-destructive text-xs">{t("vitals.checkRed")}</span>}
			>
				<Vitals draft={draft} previous={previous} onChange={change} invalid={invalid} />
			</Section>

			<Section icon={LuScanSearch} title={t("sections.examination")} aside={phrases("examination")}>
				{note("examination", "min-h-32")}
			</Section>

			<Section icon={LuStethoscope} title={t("sections.diagnosis")} aside={phrases("diagnosis")}>
				{note("diagnosis", "min-h-16")}
			</Section>

			<Section icon={LuClipboardList} title={t("sections.plan")} aside={phrases("plan")}>
				{note("plan", "min-h-32")}
			</Section>

			<Section icon={LuCalendarClock} title={t("sections.nextVisit")}>
				<div className="grid gap-1.5">
					{note("nextVisitNote", "min-h-12")}
					<p className="text-muted-foreground text-xs">{t("nextVisitHint")}</p>
				</div>
			</Section>
		</div>
	);
}

function Section({
	icon: Icon,
	title,
	aside,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="bg-card rounded-xl border">
			<header className="flex items-center gap-2 px-4 pt-4 pb-3">
				<span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
					<Icon className="size-4" />
				</span>
				<h2 className="text-sm font-semibold">{title}</h2>
				<span className="ms-auto">{aside}</span>
			</header>
			<div className="px-4 pb-4">{children}</div>
		</section>
	);
}

function Labeled({
	label,
	htmlFor,
	aside,
	children,
}: {
	label: string;
	htmlFor: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-1.5">
			<div className="flex items-center justify-between gap-2">
				<label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
					{label}
				</label>
				{aside}
			</div>
			{children}
		</div>
	);
}

/** The constants as a compact grid; abnormal values in amber, impossible ones in red. */
function Vitals({
	draft,
	previous,
	onChange,
	invalid,
}: {
	draft: ConsultationDraft;
	previous: PastConsultation | undefined;
	onChange: (field: VitalField, value: string) => void;
	invalid: VitalField[];
}) {
	const t = useTranslations("dossier.vitals");
	const format = useFormat();
	const bmi = bmiOf(toNumber(draft.weightKg), toNumber(draft.heightCm));

	const input = (field: VitalField, unit: string, className?: string) => {
		const bad = invalid.includes(field);
		const abnormal = !bad && isAbnormal(field, toNumber(draft[field]));
		return (
			<div
				className={cn(
					"border-input bg-background focus-within:ring-ring/50 focus-within:border-ring flex h-10 items-center rounded-md border px-3 transition-[color,box-shadow] focus-within:ring-[3px]",
					abnormal && "border-amber-400 bg-amber-50",
					bad && "border-destructive bg-destructive/5",
					className,
				)}
			>
				<input
					id={`vital-${field}`}
					inputMode="decimal"
					autoComplete="off"
					value={draft[field]}
					onChange={(e) => onChange(field, e.target.value)}
					aria-invalid={bad}
					className={cn(
						"w-full min-w-0 bg-transparent text-base font-semibold tabular-nums outline-none md:text-sm",
						abnormal && "text-amber-800",
					)}
				/>
				{unit && <span className="text-muted-foreground ms-1 shrink-0 text-xs">{unit}</span>}
			</div>
		);
	};

	const cell = (label: string, htmlFor: string, children: React.ReactNode, hint?: React.ReactNode) => (
		<div className="grid content-start gap-1.5">
			<label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
				{label}
			</label>
			{children}
			{hint}
		</div>
	);

	// Height barely changes: last visit's is one click away.
	const reuseHeight =
		!draft.heightCm && previous?.heightCm ? (
			<button
				type="button"
				className="text-primary w-fit text-xs hover:underline"
				onClick={() => onChange("heightCm", String(previous.heightCm))}
			>
				{t("reuse", { value: `${previous.heightCm} cm` })}
			</button>
		) : null;
	const lastWeight =
		previous?.weightKg != null ? (
			<span className="text-muted-foreground text-xs">
				{t("last", { value: `${previous.weightKg} kg`, date: format.date(previous.date) })}
			</span>
		) : null;

	const group = (title: string, children: React.ReactNode) => (
		<div className="grid gap-2">
			<p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{title}</p>
			<div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">{children}</div>
		</div>
	);

	// Grouped like a paper chart: general, cardio-vascular, blood sugar.
	return (
		<div className="grid gap-5">
			{group(
				t("groups.general"),
				<>
					{cell(t("weight"), "vital-weightKg", input("weightKg", "kg"), lastWeight)}
					{cell(t("height"), "vital-heightCm", input("heightCm", "cm"), reuseHeight)}
				{cell(
					t("bmi"),
					"vital-bmi",
					<div
						id="vital-bmi"
						className={cn(
							"bg-muted/50 flex h-10 items-center justify-between rounded-md px-3 text-sm",
							bmi === null && "text-muted-foreground",
						)}
					>
						<span className="font-semibold tabular-nums">{bmi ?? "—"}</span>
						{bmi !== null && (
							<span
								className={cn(
									"rounded px-1.5 text-[11px] font-medium",
									bmiCategory(bmi) === "normal"
										? "bg-emerald-100 text-emerald-800"
										: "bg-amber-100 text-amber-800",
								)}
							>
								{t(`bmiCategory.${bmiCategory(bmi)}`)}
							</span>
						)}
					</div>,
				)}
					{cell(t("temperature"), "vital-temperature", input("temperature", "°C"))}
				</>,
			)}
			{group(
				t("groups.cardio"),
				<>
					<div className="col-span-2">
						{cell(
							t("bloodPressure"),
							"vital-systolic",
							<div className="flex items-center gap-1.5">
								{input("systolic", "", "min-w-0 flex-1")}
								<span className="text-muted-foreground">/</span>
								{input("diastolic", "", "min-w-0 flex-1")}
								<span className="text-muted-foreground shrink-0 text-xs">mmHg</span>
							</div>,
						)}
					</div>
					{cell(t("heartRate"), "vital-heartRate", input("heartRate", "bpm"))}
					{cell(t("spo2"), "vital-spo2", input("spo2", "%"))}
				</>,
			)}
			{group(
				t("groups.glycemia"),
				<>
					{cell(t("glycemia"), "vital-glycemia", input("glycemia", "g/L"))}
					{cell(t("glycemiaPostprandial"), "vital-glycemiaPostprandial", input("glycemiaPostprandial", "g/L"))}
					{cell(t("hba1c"), "vital-hba1c", input("hba1c", "%"))}
				</>,
			)}
		</div>
	);
}
