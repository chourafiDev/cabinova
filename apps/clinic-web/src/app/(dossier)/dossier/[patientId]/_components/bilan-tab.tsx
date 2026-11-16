"use client";

import { moroccoDay } from "@cabinova/morocco-time";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import {
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
	IconChart,
	IconChevronsUpDown,
	IconLab,
	IconPlus,
	IconSearch,
	IconSpinner,
	IconTable,
	IconTrash,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import {
	byCatalogOrder,
	foldLab,
	LAB_CATALOG,
	labNumeric as numeric,
	type LabResult,
	labResultsKey,
	type LabTest,
} from "@/lib/lab-results";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { BilanCharts } from "./bilan-charts";

type View = "table" | "charts";

/**
 * Bilan: the analyses the patient had done elsewhere, kept across visits.
 * A test from the catalog, its value and the day of the analysis, then all of
 * them as a grid (a row per test, a column per date) or as a curve per test. (Bilan biologique,
 * the analyses the doctor asks for, is another tab.)
 */
export function BilanTab({ patientId, appointmentId }: { patientId: string; appointmentId: string | null }) {
	const t = useTranslations("dossier.bilan");
	const results = useQuery({
		queryKey: labResultsKey(patientId),
		queryFn: () => api<LabResult[]>(`/patients/${patientId}/lab-results`),
	});
	const [view, setView] = useState<View>("table");

	return (
		<div className="grid gap-4">
			<section className="bg-card grid gap-3 rounded-xl border p-4">
				<header className="flex items-center gap-2">
					<span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
						<IconLab className="size-4" />
					</span>
					<h2 className="text-sm font-semibold">{t("add")}</h2>
				</header>
				<AddResult patientId={patientId} appointmentId={appointmentId} />
			</section>

			<section className="bg-card grid gap-3 rounded-xl border p-4" aria-label={t("title")}>
				<Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="flex items-center gap-2 text-sm font-semibold">
						{t("title")}
						{!!results.data?.length && (
							<span className="text-muted-foreground font-normal tabular-nums">{results.data.length}</span>
						)}
					</h2>
					<TabsList className="h-8">
						<TabsTrigger value="table" className="gap-1.5 px-3 text-xs">
							<IconTable className="size-3.5" /> {t("views.table")}
						</TabsTrigger>
						<TabsTrigger value="charts" className="gap-1.5 px-3 text-xs">
							<IconChart className="size-3.5" /> {t("views.charts")}
						</TabsTrigger>
					</TabsList>
				</div>
				{results.isPending ? (
					<Skeleton className="h-32 rounded-lg" />
				) : results.isError ? (
					<p className="text-destructive text-sm">{t("loadError")}</p>
				) : results.data.length === 0 ? (
					<p className="text-muted-foreground py-6 text-center text-sm">{t("empty")}</p>
				) : (
					<>
						<TabsContent value="table">
							<ResultsGrid patientId={patientId} appointmentId={appointmentId} results={results.data} />
						</TabsContent>
						<TabsContent value="charts">
							<BilanCharts results={results.data} />
						</TabsContent>
					</>
				)}
				</Tabs>
			</section>
		</div>
	);
}

/** One line: the test, its value (with the catalog's unit), the day; Enter adds it. */
function AddResult({ patientId, appointmentId }: { patientId: string; appointmentId: string | null }) {
	const t = useTranslations("dossier.bilan");
	const queryClient = useQueryClient();
	const today = moroccoDay();
	const [test, setTest] = useState<LabTest | null>(null);
	const [value, setValue] = useState("");
	const [takenOn, setTakenOn] = useState(today);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const valueInput = useRef<HTMLInputElement>(null);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!test) return setError(t("chooseTest"));
		if (!value.trim()) return setError(t("enterValue"));
		if (!takenOn || takenOn > today) return setError(t("dateError"));
		setSaving(true);
		setError(null);
		try {
			await api(`/patients/${patientId}/lab-results`, {
				method: "POST",
				body: JSON.stringify({
					name: test.name,
					unit: test.unit,
					value: value.trim(),
					takenOn,
					...(appointmentId && { appointmentId }),
				}),
			});
			toast.success(t("added", { name: test.name }));
			// The same day is kept: a lab report has several results.
			setTest(null);
			setValue("");
			void queryClient.invalidateQueries({ queryKey: labResultsKey(patientId) });
		} catch (err) {
			setError(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={add} className="grid gap-2">
			<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_13rem_auto]">
				<TestPicker
					value={test}
					onChange={(next) => {
						setTest(next);
						setError(null);
						// Straight to the value once the test is chosen.
						requestAnimationFrame(() => valueInput.current?.focus());
					}}
				/>
				<div className="relative">
					<Input
						ref={valueInput}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						maxLength={60}
						placeholder={t("valuePlaceholder")}
						aria-label={t("value")}
						className={cn("tabular-nums", test?.unit && "pe-16")}
					/>
					{test?.unit && (
						<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 max-w-14 -translate-y-1/2 truncate text-xs">
							{test.unit}
						</span>
					)}
				</div>
				<DatePicker value={takenOn} onChange={setTakenOn} max={today} years className="h-9" />
				<Button type="submit" disabled={saving}>
					{saving ? <IconSpinner className="animate-spin" /> : <IconPlus />} {t("addButton")}
				</Button>
			</div>
			{error && <p className="text-destructive text-xs">{error}</p>}
		</form>
	);
}

/** The catalog, searched by name or other words ("nfs", "tgo"), grouped as on a lab report. */
function TestPicker({ value, onChange }: { value: LabTest | null; onChange: (test: LabTest) => void }) {
	const t = useTranslations("dossier.bilan");
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={t("test")}
					className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
				>
					<span className="truncate">{value?.name ?? t("testPlaceholder")}</span>
					<IconChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
				<Command>
					<CommandInput placeholder={t("search")} />
					<CommandList className="max-h-72">
						<CommandEmpty>{t("noTest")}</CommandEmpty>
						{LAB_CATALOG.map(({ group, tests }) => (
							<CommandGroup key={group} heading={group}>
								{tests.map((test) => (
									<CommandItem
										key={test.name}
										value={test.name}
										keywords={[group, test.keywords ?? ""]}
										onSelect={() => {
											onChange(test);
											setOpen(false);
										}}
									>
										<span className="min-w-0 flex-1 truncate">{test.name}</span>
										{test.unit && <span className="text-muted-foreground text-xs">{test.unit}</span>}
										<IconCheck className={cn("size-4", value?.name === test.name ? "opacity-100" : "opacity-0")} />
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/**
 * The patient's results as a grid: a row per test (searchable, the first
 * column stays put), a column per analysis date (newest first), the value in
 * each cell with how it moved since the test's previous date. An empty cell
 * adds a value for that test and day; a filled one shows it, to delete.
 */
function ResultsGrid({
	patientId,
	appointmentId,
	results,
}: {
	patientId: string;
	appointmentId: string | null;
	results: LabResult[];
}) {
	const t = useTranslations("dossier.bilan");
	const format = useFormat();
	const [search, setSearch] = useState("");
	// The date in focus (its tile filled, its column tinted): the latest until the doctor picks another.
	const [picked, setPicked] = useState<string | null>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const [edge, setEdge] = useState({ start: true, end: true });
	const measure = () => {
		const el = scroller.current;
		if (!el) return;
		const left = Math.abs(el.scrollLeft);
		setEdge({ start: left < 4, end: left + el.clientWidth >= el.scrollWidth - 4 });
	};
	useEffect(() => {
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [results.length]);
	/** One step through the dates: towards the older ones, or back. */
	const step = (towardsEnd: boolean) => {
		const el = scroller.current;
		if (!el) return;
		const rtl = getComputedStyle(el).direction === "rtl";
		el.scrollBy({ left: (towardsEnd ? 1 : -1) * (rtl ? -1 : 1) * 280, behavior: "smooth" });
	};

	const dates = [...new Set(results.map((r) => r.takenOn))].sort((a, b) => b.localeCompare(a));
	const focus = picked && dates.includes(picked) ? picked : dates[0];
	const cells = new Map<string, LabResult[]>();
	const units = new Map<string, string | null>();
	for (const r of results) {
		const key = `${r.name}|${r.takenOn}`;
		cells.set(key, [...(cells.get(key) ?? []), r]);
		if (!units.has(r.name)) units.set(r.name, r.unit);
	}
	const tests = [...units.keys()].filter((name) => foldLab(name).includes(foldLab(search.trim()))).sort(byCatalogOrder);

	const scrolls = !(edge.start && edge.end);
	return (
		<div className="bg-card overflow-hidden rounded-2xl border">
			{/* Scrolls both ways; the dates and the tests stay in view. */}
			<div ref={scroller} onScroll={measure} className="max-h-[70vh] overflow-auto">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr>
							<th className="bg-card sticky start-0 top-0 z-30 w-60 min-w-60 border-b px-5 pt-4 pb-3 text-start align-bottom font-normal">
								<div className="relative">
									<IconSearch className="text-muted-foreground/70 pointer-events-none absolute start-0 top-1/2 size-4 -translate-y-1/2" />
									<input
										type="search"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder={t("gridSearch")}
										aria-label={t("gridSearch")}
										className="placeholder:text-muted-foreground/60 focus:border-highlight w-full border-b border-transparent bg-transparent py-1.5 ps-6 text-sm outline-none transition-colors"
									/>
								</div>
								<p className="text-muted-foreground/70 mt-1.5 text-[11px]">{t("gridTitle", { count: tests.length })}</p>
							</th>
							{/* The dates: the one in focus a teal pill, a click focuses another. */}
							{dates.map((date) => {
								const active = date === focus;
								return (
									<th key={date} scope="col" className="bg-card sticky top-0 z-20 min-w-28 border-b px-1 pt-4 pb-3 font-normal">
										<button
											type="button"
											aria-pressed={active}
											onClick={() => setPicked(date)}
											className={cn(
												"focus-visible:ring-highlight/50 mx-auto flex w-20 flex-col items-center rounded-2xl py-2 transition-all focus-visible:ring-2 focus-visible:outline-none",
												active ? "bg-highlight text-white " : "hover:bg-muted/60",
											)}
										>
											<span
												className={cn(
													"text-[10px] font-medium tracking-[0.12em] uppercase",
													active ? "text-white/80" : "text-muted-foreground/70",
												)}
											>
												{format.date(`${date}T12:00:00`, { weekday: "short", day: undefined, month: undefined, year: undefined })}
											</span>
											<span className="text-xl leading-tight font-semibold tabular-nums">
												{format.date(`${date}T12:00:00`, { day: "numeric", month: undefined, year: undefined })}
											</span>
											<span className={cn("text-[10px] tracking-wide", active ? "text-white/80" : "text-muted-foreground/70")}>
												{format.date(`${date}T12:00:00`, { day: undefined, month: "short", year: "2-digit" })}
											</span>
										</button>
									</th>
								);
							})}
							{/* More dates than fit: a quiet arrow to go through them. */}
							{scrolls && (
								<th className="bg-card sticky end-0 top-0 z-30 w-14 min-w-14 border-b px-2 font-normal">
									<button
										type="button"
										onClick={() => step(!edge.end)}
										aria-label={edge.end ? t("newerDates") : t("olderDates")}
										title={edge.end ? t("newerDates") : t("olderDates")}
										className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-highlight/50 mx-auto flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
									>
										{edge.end ? (
											<IconChevronLeft className="size-4 rtl:rotate-180" />
										) : (
											<IconChevronRight className="size-4 rtl:rotate-180" />
										)}
									</button>
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{tests.length === 0 && (
							<tr>
								<td colSpan={dates.length + (scrolls ? 2 : 1)} className="text-muted-foreground p-10 text-center">
									{t("noMatch")}
								</td>
							</tr>
						)}
						{tests.map((name) => (
							<tr key={name} className="group/row">
								<th
									scope="row"
									className="bg-card group-hover/row:bg-muted/40 sticky start-0 z-10 border-b border-border/60 px-5 py-3.5 text-start font-normal transition-colors"
								>
									{/* A thin accent on the row being read. */}
									<span className="bg-highlight absolute inset-y-2 start-0 w-0.5 rounded-full opacity-0 transition-opacity group-hover/row:opacity-100" />
									<span className="block truncate font-medium">{name}</span>
									{units.get(name) && <span className="text-muted-foreground/70 block text-[11px]">{units.get(name)}</span>}
								</th>
								{dates.map((date, i) => {
									const here = cells.get(`${name}|${date}`);
									// The test's previous value: the next older date that has one.
									const older = dates.slice(i + 1).map((d) => cells.get(`${name}|${d}`)?.[0]).find(Boolean);
									return (
										<td
											key={date}
											className={cn(
												"group-hover/row:bg-muted/40 border-b border-border/60 px-1 py-1 text-center transition-colors",
												date === focus && "bg-highlight/[0.06]",
											)}
										>
											{here ? (
												<FilledCell patientId={patientId} results={here} older={older} />
											) : (
												<EmptyCell
													patientId={patientId}
													appointmentId={appointmentId}
													name={name}
													unit={units.get(name) ?? null}
													date={date}
												/>
											)}
										</td>
									);
								})}
								{scrolls && <td className="bg-card sticky end-0 border-b border-border/60" />}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** A value: on a click, its details and the delete button. */
function FilledCell({
	patientId,
	results,
	older,
}: {
	patientId: string;
	results: LabResult[];
	older: LabResult | undefined;
}) {
	const t = useTranslations("dossier.bilan");
	const format = useFormat();
	const latest = results[0];
	const now = numeric(latest.value);
	const before = older ? numeric(older.value) : null;
	const trend = now !== null && before !== null && now !== before ? (now > before ? "up" : "down") : null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="hover:bg-highlight/10 focus-visible:ring-highlight/50 inline-flex items-baseline justify-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
				>
					<span dir="ltr">{results.map((r) => r.value).join(" / ")}</span>
					{trend && (
						<span
							className={cn("text-[11px] font-bold", trend === "up" ? "text-amber-600" : "text-sky-600")}
							title={t("trend", { value: older!.value })}
							aria-label={t("trend", { value: older!.value })}
						>
							{trend === "up" ? "↑" : "↓"}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align="center" className="grid w-64 gap-3 p-3 text-sm">
				{results.map((r) => (
					<div key={r.id} className="grid gap-1">
						<p className="text-muted-foreground text-xs">{r.name}</p>
						<p className="text-xl font-semibold tabular-nums" dir="ltr">
							{r.value}
							{r.unit && <span className="text-muted-foreground ms-1 text-sm font-normal">{r.unit}</span>}
						</p>
						<p className="text-muted-foreground text-xs">
							{format.date(`${r.takenOn}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })}
							{r.createdBy && ` · ${r.createdBy}`}
						</p>
						{older && r === latest && (
							<p className="text-muted-foreground text-xs">
								{t("previous", {
									value: `${older.value}${older.unit ? ` ${older.unit}` : ""}`,
									date: format.date(`${older.takenOn}T12:00:00`, { day: "numeric", month: "short" }),
								})}
							</p>
						)}
						<div className="flex justify-end">
							<DeleteResult patientId={patientId} result={r} />
						</div>
					</div>
				))}
			</PopoverContent>
		</Popover>
	);
}

/** No value yet for this test and day: a click adds one, right here. */
function EmptyCell({
	patientId,
	appointmentId,
	name,
	unit,
	date,
}: {
	patientId: string;
	appointmentId: string | null;
	name: string;
	unit: string | null;
	date: string;
}) {
	const t = useTranslations("dossier.bilan");
	const format = useFormat();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const [saving, setSaving] = useState(false);

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!value.trim()) return;
		setSaving(true);
		try {
			await api(`/patients/${patientId}/lab-results`, {
				method: "POST",
				body: JSON.stringify({ name, unit, value: value.trim(), takenOn: date, ...(appointmentId && { appointmentId }) }),
			});
			toast.success(t("added", { name }));
			setValue("");
			setOpen(false);
			void queryClient.invalidateQueries({ queryKey: labResultsKey(patientId) });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={t("addHere", { name, date: format.date(`${date}T12:00:00`) })}
					className="text-highlight/0 hover:text-highlight focus-visible:text-highlight hover:bg-highlight/10 focus-visible:ring-highlight/50 inline-flex h-8 w-full items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
				>
					<IconPlus className="size-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="center" className="w-64 p-3">
				<form onSubmit={add} className="grid gap-2">
					<p className="text-xs">
						<span className="font-medium">{name}</span>
						<span className="text-muted-foreground"> · {format.date(`${date}T12:00:00`, { day: "numeric", month: "short" })}</span>
					</p>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Input
								autoFocus
								value={value}
								onChange={(e) => setValue(e.target.value)}
								maxLength={60}
								placeholder={t("valuePlaceholder")}
								aria-label={t("value")}
								className={cn("h-9 tabular-nums", unit && "pe-14")}
							/>
							{unit && (
								<span className="text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 max-w-12 -translate-y-1/2 truncate text-xs">
									{unit}
								</span>
							)}
						</div>
						<Button type="submit" size="icon" className="size-9" disabled={saving || !value.trim()} aria-label={t("addButton")}>
							{saving ? <IconSpinner className="animate-spin" /> : <IconCheck />}
						</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}

/** A first click asks, a second one deletes. */
function DeleteResult({ patientId, result }: { patientId: string; result: LabResult }) {
	const t = useTranslations("dossier.bilan");
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);

	const remove = async () => {
		setPending(true);
		try {
			await api(`/patients/${patientId}/lab-results/${result.id}`, { method: "DELETE" });
			toast.success(t("deleted", { name: result.name }));
			void queryClient.invalidateQueries({ queryKey: labResultsKey(patientId) });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setPending(false);
			setConfirming(false);
		}
	};

	return confirming ? (
		<Button
			variant="destructive"
			size="icon"
			className="size-8"
			disabled={pending}
			aria-label={t("confirmDelete", { name: result.name })}
			title={t("confirmDelete", { name: result.name })}
			onClick={() => void remove()}
			onBlur={() => setConfirming(false)}
		>
			{pending ? <IconSpinner className="animate-spin" /> : <IconTrash />}
		</Button>
	) : (
		<Button
			variant="ghost"
			size="icon"
			className="text-destructive hover:text-destructive size-8"
			aria-label={t("delete", { name: result.name })}
			title={t("delete", { name: result.name })}
			onClick={() => setConfirming(true)}
		>
			<IconTrash />
		</Button>
	);
}
