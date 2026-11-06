"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconBuilding, IconCalendarCheck, IconSpinner, IconWarning } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Sheet,
	SHEET_AT_END,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api-client";
import { APPOINTMENTS_KEY, type Practitioner } from "@/lib/appointments";
import { CLOSURE_KINDS, CLOSURES_KEY, type ClosureKind, type Conflict, canManage, dayKey, daysIn, KIND_ICONS } from "@/lib/closures";
import { fullName } from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** The select's "whole cabinet" (Radix wants a non-empty value). */
const CABINET = "__cabinet";

/**
 * Recording days off: whose (a doctor, or the whole cabinet), why, from when
 * to when. The appointments already booked then are listed before saving,
 * so nobody is surprised.
 */
export function ClosureSheet({
	open,
	onOpenChange,
	practitioners,
	user,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	practitioners: Practitioner[];
	user: { id: string; role: string };
}) {
	const t = useTranslations("absences");
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className={`w-full gap-0 data-[side=right]:sm:max-w-2xl ${SHEET_AT_END}`}>
				<SheetHeader className="border-b p-5">
					<SheetTitle className="text-xl">{t("form.title")}</SheetTitle>
					<SheetDescription>{t("form.description")}</SheetDescription>
				</SheetHeader>
				{open && <ClosureForm practitioners={practitioners} user={user} onDone={() => onOpenChange(false)} />}
			</SheetContent>
		</Sheet>
	);
}

function ClosureForm({
	practitioners,
	user,
	onDone,
}: {
	practitioners: Practitioner[];
	user: { id: string; role: string };
	onDone: () => void;
}) {
	const t = useTranslations("absences");
	const fmt = useFormat();
	const queryClient = useQueryClient();
	// Who this person may record days for; a doctor starts on themself.
	const whom = practitioners.filter((p) => canManage(user, p.id));
	const [who, setWho] = useState(user.role === "doctor" ? user.id : (whom[0]?.id ?? CABINET));
	const [kind, setKind] = useState<ClosureKind>("vacation");
	const [from, setFrom] = useState(dayKey(new Date()));
	const [to, setTo] = useState(dayKey(new Date()));
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const practitionerId = who === CABINET ? null : who;
	const validDates = !!from && !!to && to >= from;
	const days = validDates ? daysIn(from, to) : 0;
	const range = useDebouncedValue({ from, to, practitionerId }, 300);
	const conflicts = useQuery({
		queryKey: ["closure-conflicts", range],
		queryFn: () =>
			api<Conflict[]>(
				`/closures/conflicts?${new URLSearchParams({
					from: range.from,
					to: range.to,
					...(range.practitionerId && { practitionerId: range.practitionerId }),
				})}`,
			),
		enabled: !!range.from && !!range.to && range.to >= range.from,
	});

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!validDates) {
			setError(t("form.datesError"));
			return;
		}
		setSaving(true);
		try {
			await api("/closures", {
				method: "POST",
				body: JSON.stringify({ practitionerId, kind, startsOn: from, endsOn: to, note }),
			});
			toast.success(t("form.saved"));
			void queryClient.invalidateQueries({ queryKey: CLOSURES_KEY });
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			onDone();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("form.saveError"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
			<FieldGroup className="min-h-0 flex-1 content-start overflow-y-auto p-5">
				<Field>
					<FieldLabel htmlFor="closure-who">{t("form.who")}</FieldLabel>
					<Select value={who} onValueChange={setWho}>
						<SelectTrigger id="closure-who" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{user.role === "owner" && (
								<SelectItem value={CABINET}>
									<IconBuilding /> {t("wholeCabinet")}
								</SelectItem>
							)}
							{whom.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{practitionerId ? t("form.whoDoctor") : t("form.whoCabinet")}
					</p>
				</Field>

				<Field>
					<FieldLabel>{t("form.kind")}</FieldLabel>
					<div role="radiogroup" aria-label={t("form.kind")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{CLOSURE_KINDS.map((k) => {
							const Icon = KIND_ICONS[k];
							return (
								<button
									key={k}
									type="button"
									role="radio"
									aria-checked={kind === k}
									onClick={() => setKind(k)}
									className={cn(
										"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
										kind === k ? "border-primary bg-primary/5 text-primary font-medium" : "hover:bg-accent",
									)}
								>
									<Icon className="size-4 shrink-0" /> {t(`kinds.${k}`)}
								</button>
							);
						})}
					</div>
				</Field>

				<div className="grid grid-cols-2 gap-3">
					<Field data-invalid={!!error}>
						<FieldLabel htmlFor="closure-from">{t("form.from")}</FieldLabel>
						<Input
							id="closure-from"
							type="date"
							value={from}
							onChange={(e) => {
								setFrom(e.target.value);
								setError(null);
								// A single day by default: the end follows the start until moved.
								if (!to || to < e.target.value) setTo(e.target.value);
							}}
						/>
					</Field>
					<Field data-invalid={!!error}>
						<FieldLabel htmlFor="closure-to">{t("form.to")}</FieldLabel>
						<Input
							id="closure-to"
							type="date"
							min={from}
							value={to}
							onChange={(e) => {
								setTo(e.target.value);
								setError(null);
							}}
						/>
					</Field>
				</div>
				{error ? (
					<FieldError errors={[{ message: error }]} />
				) : (
					validDates && <p className="text-muted-foreground -mt-2 text-xs">{t("days", { count: days })}</p>
				)}

				<Field>
					<FieldLabel htmlFor="closure-note">{t("form.note")}</FieldLabel>
					<Textarea
						id="closure-note"
						rows={2}
						maxLength={500}
						placeholder={t("form.notePlaceholder")}
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
				</Field>

				{validDates && conflicts.data && (
					conflicts.data.length === 0 ? (
						<p className="flex items-center gap-2 rounded-lg border bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
							<IconCalendarCheck className="size-4 shrink-0" /> {t("form.noConflicts")}
						</p>
					) : (
						<div className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
							<p className="flex items-start gap-2 font-medium">
								<IconWarning className="mt-0.5 size-4 shrink-0" />
								{t("form.conflicts", { count: conflicts.data.length })}
							</p>
							<ul className="grid gap-1 ps-6 text-xs">
								{conflicts.data.slice(0, 6).map((c) => (
									<li key={c.id} className="flex justify-between gap-3">
										<span className="truncate">{fullName(c.patient)}</span>
										<span className="shrink-0 tabular-nums first-letter:uppercase">
											{fmt.date(c.startsAt, { weekday: "short", day: "numeric", month: "short", year: undefined })} · {fmt.clock(c.startsAt)}
											{!practitionerId && ` · ${c.practitioner.name}`}
										</span>
									</li>
								))}
								{conflicts.data.length > 6 && <li>{t("form.more", { count: conflicts.data.length - 6 })}</li>}
							</ul>
							<p className="text-xs">{t("form.conflictsHint")}</p>
						</div>
					)
				)}
			</FieldGroup>

			<SheetFooter className="mx-0 mb-0 flex-row justify-end gap-2 border-t px-5 py-3">
				<Button type="button" variant="ghost" onClick={onDone}>
					{t("cancel")}
				</Button>
				<Button type="submit" disabled={saving}>
					{saving && <IconSpinner className="animate-spin" />}
					{t("form.submit")}
				</Button>
			</SheetFooter>
		</form>
	);
}
