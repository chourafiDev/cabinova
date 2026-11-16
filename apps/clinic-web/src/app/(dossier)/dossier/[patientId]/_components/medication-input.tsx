"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { IconHistory, IconPlus, IconSpinner, IconStar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatPpv, type MedicationSearch, type MedicationSuggestion, medicationSearchKey } from "@/lib/medications";
import type { KnownMedication } from "@/lib/prescriptions";
import { cn } from "@/lib/utils";

/** What the doctor picked: a suggestion, a line they prescribed before, or a name to add to their medicines. */
export type MedicationPick =
	| { kind: "suggestion"; suggestion: MedicationSuggestion }
	| { kind: "past"; medication: KnownMedication }
	| { kind: "create"; name: string };

type Option = MedicationPick & { id: string };

const SEARCH_DELAY_MS = 200;
const PAST_SHOWN = 3;

const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();

/**
 * The medication's name, with suggestions from 2 letters: the doctor's own
 * medicines and the AMMPS list (favorites first, their wording and usual
 * posology), then what they prescribed before, then "add to my medicines".
 * ↑ ↓ Enter, Escape; the text stays free for anything else.
 */
export function MedicationInput({
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
	onPick: (pick: MedicationPick) => void;
}) {
	const t = useTranslations("dossier.prescription.suggest");
	const locale = useLocale();
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const [query, setQuery] = useState("");

	// Asks the server once typing pauses.
	useEffect(() => {
		const timer = setTimeout(() => setQuery(value.trim()), SEARCH_DELAY_MS);
		return () => clearTimeout(timer);
	}, [value]);

	const enabled = open && query.length >= 2;
	const search = useQuery({
		queryKey: medicationSearchKey(query),
		queryFn: () => api<MedicationSearch>(`/medications/search?q=${encodeURIComponent(query)}`),
		enabled,
		staleTime: 60_000,
		placeholderData: keepPreviousData,
	});

	const typed = fold(value);
	const suggestions = enabled ? (search.data?.items ?? []) : [];
	const labels = new Set(suggestions.map((s) => fold(s.label)));
	const past =
		typed.length < 2
			? []
			: known
					.filter((m) => {
						const text = fold(m.medication);
						return text.includes(typed) && text !== typed && !labels.has(text);
					})
					.slice(0, PAST_SHOWN);
	// Anything typed can join the doctor's own medicines, unless it is already one.
	const canCreate =
		typed.length >= 2 && !suggestions.some((s) => s.source === "custom" && fold(s.name) === typed);

	const options: Option[] = [
		...suggestions.map((s) => ({ kind: "suggestion" as const, suggestion: s, id: s.key })),
		...past.map((m) => ({ kind: "past" as const, medication: m, id: `past:${m.medication}` })),
		...(canCreate ? [{ kind: "create" as const, name: value.trim(), id: "create" }] : []),
	];
	const shown = open && typed.length >= 2 && (options.length > 0 || search.isFetching);
	const current = Math.min(active, Math.max(0, options.length - 1));

	const pick = (option: Option) => {
		onPick(option);
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
					if (!shown || !options.length) return;
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						const step = e.key === "ArrowDown" ? 1 : -1;
						setActive((current + step + options.length) % options.length);
					} else if (e.key === "Enter") {
						e.preventDefault();
						pick(options[current]);
					} else if (e.key === "Escape") {
						setOpen(false);
					}
				}}
				placeholder={placeholder}
				role="combobox"
				aria-expanded={shown}
				aria-controls={listId}
				aria-activedescendant={shown && options[current] ? `${listId}-${current}` : undefined}
				aria-autocomplete="list"
				autoComplete="off"
				maxLength={300}
				className="bg-background font-medium"
			/>
			{shown && (
				<div
					className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg"
					// Before the input's blur, or the list is gone.
					onMouseDown={(e) => e.preventDefault()}
				>
					<ul id={listId} role="listbox" aria-label={t("label")} className="grid max-h-80 gap-0.5 overflow-y-auto p-1">
						{options.map((option, i) => {
							const first = i === 0 || options[i - 1].kind !== option.kind;
							return (
								<li key={option.id} role="presentation" className="contents">
									{first && option.kind === "past" && (
										<p className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium">{t("past")}</p>
									)}
									<div
										id={`${listId}-${i}`}
										role="option"
										aria-selected={i === current}
										onMouseDown={() => pick(option)}
										onMouseEnter={() => setActive(i)}
										className={cn(
											"cursor-pointer rounded-md px-2 py-1.5 text-sm",
											i === current && "bg-accent",
											option.kind === "create" && "border-t mt-1 rounded-t-none pt-2",
										)}
									>
										{option.kind === "suggestion" && <SuggestionRow s={option.suggestion} locale={locale} />}
										{option.kind === "past" && (
											<div className="flex items-start gap-2">
												<IconHistory className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
												<div className="min-w-0">
													<p className="truncate font-medium">
														<bdi>{option.medication.medication}</bdi>
													</p>
													{(option.medication.posology || option.medication.duration) && (
														<p className="text-muted-foreground truncate text-xs">
															<bdi>{[option.medication.posology, option.medication.duration].filter(Boolean).join(" · ")}</bdi>
														</p>
													)}
												</div>
											</div>
										)}
										{option.kind === "create" && (
											<p className="text-primary flex items-center gap-2 text-xs font-medium">
												<IconPlus className="size-3.5 shrink-0" />
												<span className="truncate">{t("create", { name: option.name })}</span>
											</p>
										)}
									</div>
								</li>
							);
						})}
					</ul>
					{(search.isFetching || search.data?.catalog === false) && (
						<p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-1.5 text-[11px]">
							{search.isFetching ? (
								<>
									<IconSpinner className="size-3 animate-spin" /> {t("searching")}
								</>
							) : (
								t("noCatalog")
							)}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

/** An AMMPS medicine or one of the doctor's own: name and dosage, then form, substances, boxes, price. */
function SuggestionRow({ s, locale }: { s: MedicationSuggestion; locale: string }) {
	const t = useTranslations("dossier.prescription.suggest");
	const ppv = formatPpv(s.ppv, locale);
	const boxes = s.presentations.length;
	const details = [
		s.form?.toLowerCase(),
		s.substances?.split(/\s*\/\/\s*/).join(" + ").toLowerCase(),
		boxes > 1 ? t("boxes", { count: boxes }) : s.presentations[0]?.presentation?.toLowerCase(),
	].filter(Boolean);
	return (
		<div className="flex items-start gap-2">
			<span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
				{s.isFavorite && <IconStar className="size-3.5 text-amber-500" aria-label={t("favorite")} />}
			</span>
			<div className="min-w-0 flex-1">
				<p className="flex items-baseline gap-1.5">
					<bdi className="truncate font-medium">
						{s.name}
						{s.dosage && <span className="text-foreground/80 font-normal"> {s.dosage}</span>}
					</bdi>
					{s.source === "custom" && (
						<span className="bg-primary/10 text-primary shrink-0 rounded px-1 text-[10px] font-medium">{t("mine")}</span>
					)}
					{s.availability === "not_marketed" && (
						<span className="bg-muted text-muted-foreground shrink-0 rounded px-1 text-[10px] font-medium">
							{t("notMarketed")}
						</span>
					)}
					{s.updatedByAmmps && (
						<span className="shrink-0 rounded bg-sky-500/10 px-1 text-[10px] font-medium text-sky-700 dark:text-sky-400">
							{t("updated")}
						</span>
					)}
				</p>
				{details.length > 0 && (
					<p className="text-muted-foreground truncate text-xs">
						<bdi>{details.join(" · ")}</bdi>
					</p>
				)}
				{s.defaultPosology && (
					<p className="text-muted-foreground/80 truncate text-[11px] italic">
						<bdi>{s.defaultPosology}</bdi>
					</p>
				)}
			</div>
			{ppv && <span className="text-muted-foreground shrink-0 text-xs tabular-nums" dir="ltr">{ppv}</span>}
		</div>
	);
}
