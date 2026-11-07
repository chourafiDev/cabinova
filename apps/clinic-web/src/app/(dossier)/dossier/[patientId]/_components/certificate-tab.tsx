"use client";

import { moroccoDay } from "@cabinova/morocco-time";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { DatePicker } from "@/components/date-picker";
import {
	IconBan,
	IconHistory,
	IconPlus,
	IconPrinter,
	IconReset,
	IconSearch,
	IconSettings,
	IconSignature,
	IconSpinner,
} from "@/components/icons";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { blankCertificate, CATALOG, fold, matches } from "@/lib/certificate-catalog";
import {
	BUILT_IN,
	type Certificate,
	type CertificateKind,
	type CertificateModel,
	certificatesKey,
	fillBlanks,
	MODELS_KEY,
	periodDays,
	periodEnd,
} from "@/lib/certificates";
import type { PatientFile } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ModelsSheet } from "./certificate-models";
import { Card } from "./patient-aside";

/** The model the text came from: one of Cabinova's, the doctor's own, or the library's. */
type Template = { key: string; body: string };

/**
 * Certificat tab: a certificate for one day or a period, from a model whose
 * blanks (patient, dates, days…) follow the form until the doctor edits the
 * text; then saved for good and printed. Below, the patient's certificates.
 */
export function CertificateTab({ patient, appointmentId }: { patient: PatientFile; appointmentId: string | null }) {
	const t = useTranslations("dossier.certificate");
	const user = useCurrentUser();
	const queryClient = useQueryClient();
	const today = moroccoDay();
	const [kind, setKind] = useState<CertificateKind>("period");
	const [startsOn, setStartsOn] = useState(today);
	const [endsOn, setEndsOn] = useState(periodEnd(today, 3));
	const [template, setTemplate] = useState<Template>({ key: "rest", body: BUILT_IN[0].body });
	// Edited by hand: the dates no longer rewrite the text.
	const [edited, setEdited] = useState(false);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);
	const [managing, setManaging] = useState(false);
	// The last certificate found by name, offered like a model.
	const [picked, setPicked] = useState<{ key: string; name: string; body: string } | null>(null);

	const models = useQuery({ queryKey: MODELS_KEY, queryFn: () => api<CertificateModel[]>("/certificate-models") });
	const body = edited ? text : fillBlanks(template.body, { patient, doctor: user.name, kind, startsOn, endsOn });
	const days = periodDays(startsOn, endsOn);

	const use = (next: Template, nextKind?: CertificateKind) => {
		setTemplate(next);
		setEdited(false);
		if (nextKind) setKind(nextKind);
	};
	const changeKind = (next: CertificateKind) => {
		setKind(next);
		// Cabinova's model follows the kind until the doctor writes their own text.
		const builtIn = BUILT_IN.find((m) => m.kind === next);
		if (!edited && builtIn && BUILT_IN.some((m) => m.key === template.key)) setTemplate({ key: builtIn.key, body: builtIn.body });
	};

	const save = async () => {
		if (kind === "period" && !days) return toast.error(t("datesError"));
		setSaving(true);
		try {
			const certificate = await api<Certificate>("/certificates", {
				method: "POST",
				body: JSON.stringify({
					patientId: patient.id,
					appointmentId,
					kind,
					startsOn,
					endsOn: kind === "period" ? endsOn : null,
					body,
				}),
			});
			await queryClient.invalidateQueries({ queryKey: certificatesKey(patient.id) });
			toast.success(t("saved"));
			window.open(`/certificats/${certificate.id}`, "_blank", "noopener");
			setEdited(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="grid gap-4">
			<Card icon={IconSignature} title={t("title")}>
				<div className="grid gap-4">
					<Tabs value={kind} onValueChange={(v) => changeKind(v as CertificateKind)}>
						<TabsList>
							<TabsTrigger value="day" className="px-3">
								{t("kind.day")}
							</TabsTrigger>
							<TabsTrigger value="period" className="px-3">
								{t("kind.period")}
							</TabsTrigger>
						</TabsList>
					</Tabs>

					{kind === "day" ? (
						<label className="grid w-48 gap-1 text-sm">
							<span className="text-muted-foreground text-xs">{t("date")}</span>
							<DatePicker value={startsOn} onChange={setStartsOn} />
						</label>
					) : (
						<div className="flex flex-wrap items-end gap-3">
							<label className="grid w-28 gap-1 text-sm">
								<span className="text-muted-foreground text-xs">{t("days")}</span>
								<Input
									type="number"
									min={1}
									max={365}
									value={days ?? ""}
									onChange={(e) => {
										const n = Math.min(365, Math.max(1, Number(e.target.value) || 1));
										setEndsOn(periodEnd(startsOn, n));
									}}
									className="h-9 tabular-nums"
								/>
							</label>
							<label className="grid w-44 gap-1 text-sm mr-3">
								<span className="text-muted-foreground text-xs">{t("from")}</span>
								<DatePicker
									value={startsOn}
									onChange={(day) => {
										// The length is kept: moving the start moves the end.
										if (day && days) setEndsOn(periodEnd(day, days));
										setStartsOn(day);
									}}
								/>
							</label>
							<label className="grid w-44 gap-1 text-sm">
								<span className="text-muted-foreground text-xs">{t("to")}</span>
								<DatePicker value={endsOn} min={startsOn} onChange={setEndsOn} invalid={!days} />
							</label>
						</div>
					)}

					<CertificateFinder
						models={models.data ?? []}
						kind={kind}
						onPick={(p) => {
							setPicked({ key: p.key, name: p.name, body: p.body });
							use({ key: p.key, body: p.body }, p.kind);
						}}
					/>

					<div className="grid gap-2">
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="text-muted-foreground me-1 text-xs">{t("models")}</span>
							{picked && !BUILT_IN.some((m) => m.key === picked.key) && !models.data?.some((m) => m.id === picked.key) && (
								<ModelChip active={template.key === picked.key} onClick={() => use({ key: picked.key, body: picked.body })}>
									{picked.name}
								</ModelChip>
							)}
							{BUILT_IN.map((m) => (
								<ModelChip key={m.key} active={template.key === m.key} onClick={() => use({ key: m.key, body: m.body }, m.kind)}>
									{t(`builtIn.${m.key}`)}
								</ModelChip>
							))}
							{models.data?.map((m) => (
								<ModelChip key={m.id} active={template.key === m.id} onClick={() => use({ key: m.id, body: m.body })}>
									{m.name}
								</ModelChip>
							))}
							<Button type="button" variant="ghost" size="sm" className="h-7 font-normal" onClick={() => setManaging(true)}>
								<IconSettings /> {t("manageModels")}
							</Button>
						</div>
						<RichTextEditor
							id="certificate-text"
							value={body}
							onChange={(html) => {
								setText(html);
								setEdited(true);
							}}
						/>
						{edited && (
							<button
								type="button"
								onClick={() => setEdited(false)}
								className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
							>
								<IconReset className="size-3" /> {t("reapply")}
							</button>
						)}
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
						<p className="text-muted-foreground text-xs">{t("final")}</p>
						<Button onClick={save} disabled={saving || patient.archivedAt !== null}>
							{saving ? <IconSpinner className="animate-spin" /> : <IconPrinter />} {t("saveAndPrint")}
						</Button>
					</div>
				</div>
			</Card>

			<CertificateHistory patientId={patient.id} />
			<ModelsSheet open={managing} onOpenChange={setManaging} />
		</div>
	);
}

/**
 * "Quel certificat ?": the doctor types a few letters of its name and picks
 * one of Cabinova's library or of their own models; a name the library
 * doesn't know gives a text to complete.
 */
function CertificateFinder({
	models,
	kind,
	onPick,
}: {
	models: CertificateModel[];
	/** The form's current kind, for a name the library doesn't have. */
	kind: CertificateKind;
	onPick: (picked: { key: string; name: string; body: string; kind?: CertificateKind }) => void;
}) {
	const t = useTranslations("dossier.certificate.finder");
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);

	const name = query.trim();
	const options = [
		...models
			.filter((m) => matches(name, m.name))
			.map((m) => ({ key: m.id, name: m.name, body: m.body, kind: undefined as CertificateKind | undefined, mine: true })),
		...CATALOG.filter((c) => matches(name, `${c.name} ${c.keywords}`)).map((c) => ({ ...c, mine: false })),
	];
	// A certificate the library doesn't have: its name, with blanks to complete.
	const custom = name.length >= 3 && !options.some((o) => fold(o.name) === fold(name));
	const count = options.length + (custom ? 1 : 0);

	const pick = (index: number) => {
		const option = options[index];
		if (option) onPick({ key: option.key, name: option.name, body: option.body, kind: option.kind });
		else if (custom) onPick({ key: `custom:${name}`, name, body: blankCertificate(name, kind) });
		else return;
		setQuery("");
		setOpen(false);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			setOpen(true);
			setActive((i) => (count ? (i + (e.key === "ArrowDown" ? 1 : count - 1)) % count : 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			pick(active);
		} else if (e.key === "Escape") setOpen(false);
	};

	return (
		<Popover open={open && count > 0} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<div className="relative">
					<IconSearch className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						role="combobox"
						aria-expanded={open && count > 0}
						aria-controls="certificate-finder"
						aria-label={t("label")}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActive(0);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onKeyDown={onKeyDown}
						placeholder={t("placeholder")}
						maxLength={120}
						className="h-9 ps-9"
					/>
				</div>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-(--radix-popover-trigger-width) p-1"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					// A click back in the field keeps the list open.
					if (e.target instanceof Element && e.target.closest("[role=combobox]")) e.preventDefault();
				}}
			>
				<ul id="certificate-finder" role="listbox" className="max-h-72 overflow-y-auto">
					{options.map((o, i) => (
						<FinderOption key={o.key} active={i === active} onHover={() => setActive(i)} onPick={() => pick(i)}>
							<span className="min-w-0 flex-1 truncate">{o.name}</span>
							<span className="text-muted-foreground shrink-0 text-xs">
								{o.mine ? t("mine") : o.kind === "period" ? t("period") : t("day")}
							</span>
						</FinderOption>
					))}
					{custom && (
						<FinderOption active={active === options.length} onHover={() => setActive(options.length)} onPick={() => pick(options.length)}>
							<IconPlus className="text-muted-foreground size-4 shrink-0" />
							<span className="min-w-0 flex-1 truncate">{t("custom", { name })}</span>
						</FinderOption>
					)}
				</ul>
			</PopoverContent>
		</Popover>
	);
}

function FinderOption({
	active,
	onHover,
	onPick,
	children,
}: {
	active: boolean;
	onHover: () => void;
	onPick: () => void;
	children: React.ReactNode;
}) {
	return (
		<li
			role="option"
			aria-selected={active}
			onMouseEnter={onHover}
			// Before the field's blur closes the list.
			onMouseDown={(e) => e.preventDefault()}
			onClick={onPick}
			className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", active && "bg-accent")}
		>
			{children}
		</li>
	);
}

function ModelChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			aria-pressed={active}
			onClick={onClick}
			className={cn("h-7 font-normal", active && "border-primary bg-primary/10 text-primary hover:bg-primary/15")}
		>
			{children}
		</Button>
	);
}

/** The patient's certificates: reprint, or cancel one given by mistake. */
function CertificateHistory({ patientId }: { patientId: string }) {
	const t = useTranslations("dossier.certificate");
	const format = useFormat();
	const history = useQuery({
		queryKey: certificatesKey(patientId),
		queryFn: () => api<Certificate[]>(`/certificates?patientId=${patientId}`),
	});

	return (
		<Card
			icon={IconHistory}
			title={t("history")}
			aside={history.data && history.data.length > 0 && <span className="text-muted-foreground text-xs tabular-nums">{history.data.length}</span>}
		>
			{history.isPending ? (
				<Skeleton className="h-16" />
			) : !history.data?.length ? (
				<p className="text-muted-foreground text-sm">{t("empty")}</p>
			) : (
				<ul className="divide-y">
					{history.data.map((c) => (
						<li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
							<div className="min-w-0 flex-1">
								<p className={cn("text-sm font-medium", c.cancelledAt && "text-muted-foreground line-through")}>
									{c.kind === "period"
										? t("periodSummary", {
												days: periodDays(c.startsOn, c.endsOn ?? c.startsOn) ?? 1,
												from: format.date(c.startsOn),
												to: format.date(c.endsOn ?? c.startsOn),
											})
										: t("daySummary", { date: format.date(c.startsOn) })}
								</p>
								<p className="text-muted-foreground text-xs">
									{t("givenOn", { date: format.date(c.createdAt), by: c.practitioner ?? "—" })}
									{c.cancelledAt && ` · ${t("cancelledOn", { date: format.date(c.cancelledAt), by: c.cancelledBy ?? "—" })}`}
								</p>
							</div>
							{c.cancelledAt ? (
								<Badge variant="destructive">{t("cancelled")}</Badge>
							) : (
								<HistoryActions certificate={c} />
							)}
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

function HistoryActions({ certificate }: { certificate: Certificate }) {
	const t = useTranslations("dossier.certificate");
	const queryClient = useQueryClient();
	// Cancelling can't be undone: a first click asks, a second one cancels.
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);

	const cancel = async () => {
		setPending(true);
		try {
			await api(`/certificates/${certificate.id}/cancel`, { method: "POST" });
			await queryClient.invalidateQueries({ queryKey: ["certificates"] });
			toast.success(t("cancelDone"));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("saveError"));
		} finally {
			setPending(false);
			setConfirming(false);
		}
	};

	return (
		<span className="flex items-center gap-1">
			<Button asChild variant="outline" size="sm" className="h-8">
				<a href={`/certificats/${certificate.id}`} target="_blank" rel="noopener">
					<IconPrinter /> {t("print")}
				</a>
			</Button>
			{confirming ? (
				<Button variant="destructive" size="sm" className="h-8" disabled={pending} onClick={cancel} onBlur={() => setConfirming(false)}>
					{pending ? <IconSpinner className="animate-spin" /> : <IconBan />} {t("confirmCancel")}
				</Button>
			) : (
				<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8" onClick={() => setConfirming(true)}>
					<IconBan /> {t("cancel")}
				</Button>
			)}
		</span>
	);
}
