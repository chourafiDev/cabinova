"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMinutes, format, roundToNearestMinutes } from "date-fns";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LuCalendarClock, LuCheck, LuLoader, LuSearch, LuVideo, LuZap } from "react-icons/lu";
import { toast } from "sonner";
import { GoogleMark } from "@/app/(clinic)/settings/integrations/_components/google-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Sheet,
	SHEET_AT_END,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { initials } from "@/lib/format";
import {
	CURRENT_MEETINGS_KEY,
	type GoogleStatus,
	MEETING_DURATIONS,
	MEETINGS_KEY,
	type Meeting,
	type MeetingPerson,
} from "@/lib/meetings";
import { cn } from "@/lib/utils";

/** From this many people, the list gets a search field. */
const SEARCH_FROM = 7;

/**
 * Start a Google Meet now, or plan one, with chosen members of the team: a
 * sheet beside the page (at the end side, also in Arabic), the people list
 * scrolling between a fixed header and the buttons.
 */
export function NewMeetingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className={`w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-lg ${SHEET_AT_END}`}
			>
				{/* Remounted per opening: a fresh form each time. */}
				{open && <MeetingForm onDone={() => onOpenChange(false)} />}
			</SheetContent>
		</Sheet>
	);
}

type When = "now" | "later";
type Errors = Partial<Record<"people" | "when" | "form", string>>;

function MeetingForm({ onDone }: { onDone: () => void }) {
	const t = useTranslations("meetings.new");
	const roles = useTranslations("common.roles");
	const router = useRouter();
	const queryClient = useQueryClient();

	const google = useQuery({
		queryKey: ["integrations", "google"],
		queryFn: () => api<GoogleStatus>("/integrations/google"),
	});
	const people = useQuery({
		queryKey: ["meetings", "people"],
		queryFn: () => api<MeetingPerson[]>("/meetings/people"),
	});

	const [when, setWhen] = useState<When>("now");
	const nextSlot = useMemo(() => roundToNearestMinutes(addMinutes(new Date(), 30), { nearestTo: 15, roundingMethod: "ceil" }), []);
	const [date, setDate] = useState(() => format(nextSlot, "yyyy-MM-dd"));
	const [time, setTime] = useState(() => format(nextSlot, "HH:mm"));
	const [duration, setDuration] = useState<number>(30);
	const [title, setTitle] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [search, setSearch] = useState("");
	const [errors, setErrors] = useState<Errors>({});
	const [saving, setSaving] = useState(false);

	const list = people.data ?? [];
	const shown = search.trim()
		? list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
		: list;
	const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
	const toggle = (id: string, on: boolean) => {
		setSelected((s) => {
			const next = new Set(s);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});
		clear("people");
	};
	/** A quick pick selects that group, or clears it when it's all selected already. */
	const pick = (group: MeetingPerson[]) => {
		const all = group.every((p) => selected.has(p.id));
		setSelected((s) => {
			const next = new Set(s);
			for (const p of group) {
				if (all) next.delete(p.id);
				else next.add(p.id);
			}
			return next;
		});
		clear("people");
	};
	const groups = [
		{ key: "everyone", people: list },
		{ key: "doctors", people: list.filter((p) => p.role === "doctor") },
		{ key: "secretaries", people: list.filter((p) => p.role === "secretary") },
	].filter((g) => g.people.length > 0);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const next: Errors = {};
		if (selected.size === 0) next.people = t("peopleError");
		const startsAt = when === "later" ? new Date(`${date}T${time}`) : null;
		if (startsAt && (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60_000)) {
			next.when = t("whenError");
		}
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		// Opened now, while it's still the click: browsers block it after the wait.
		const tab = when === "now" ? window.open("about:blank", "_blank") : null;
		// The Meet page gets no handle on Cabinova's tab.
		if (tab) tab.opener = null;
		setSaving(true);
		try {
			const meeting = await api<Meeting>("/meetings", {
				method: "POST",
				body: JSON.stringify({
					title: title.trim() || undefined,
					participantIds: [...selected],
					startsAt: startsAt?.toISOString(),
					durationMinutes: duration,
				}),
			});
			if (tab) tab.location.href = meeting.meetUrl;
			toast.success(when === "now" ? t("started") : t("planned"), {
				description: t("invitedHint", { count: selected.size }),
				action: {
					label: t("copyLink"),
					onClick: () => void navigator.clipboard.writeText(meeting.meetUrl),
				},
			});
			void queryClient.invalidateQueries({ queryKey: MEETINGS_KEY });
			void queryClient.invalidateQueries({ queryKey: CURRENT_MEETINGS_KEY });
			router.refresh();
			onDone();
		} catch (err) {
			tab?.close();
			setErrors({ form: err instanceof Error ? err.message : t("error") });
			void google.refetch();
		} finally {
			setSaving(false);
		}
	};

	const header = (
		<SheetHeader className="border-b p-5 pe-12">
			<SheetTitle className="flex items-center gap-2">
				<span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
					<LuVideo className="size-4" />
				</span>
				{t("title")}
			</SheetTitle>
			<SheetDescription>{t("description")}</SheetDescription>
		</SheetHeader>
	);

	if (google.isPending || people.isPending) {
		return (
			<div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
				{header}
				<div className="grid gap-3 p-5">
					<Skeleton className="h-10" />
					<Skeleton className="h-40" />
				</div>
			</div>
		);
	}

	// Nothing to create meetings with yet: say so, and get there in one step.
	if (!google.data?.connected) {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				{header}
				<div className="grid flex-1 content-center justify-items-center gap-3 p-8 text-center">
					<span className="bg-muted flex size-12 items-center justify-center rounded-full">
						<GoogleMark className="size-6" />
					</span>
					<p className="font-medium">{google.data?.configured ? t("connectFirst") : t("notConfigured")}</p>
					<p className="text-muted-foreground max-w-sm text-sm">
						{google.data?.configured ? t("connectFirstHint") : t("notConfiguredHint")}
					</p>
					{google.data?.configured && <ConnectGoogleButton />}
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
			{header}
			<div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-5">
				<FieldSet data-invalid={!!errors.people}>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<FieldLegend variant="label">{t("who")}</FieldLegend>
						<span className="text-muted-foreground text-xs" aria-live="polite">
							{t("selected", { count: selected.size })}
						</span>
					</div>
					{list.length === 0 ? (
						<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">{t("noTeam")}</p>
					) : (
						<>
							<div className="flex flex-wrap gap-1.5">
								{groups.map((g) => {
									const all = g.people.every((p) => selected.has(p.id));
									return (
										<button
											key={g.key}
											type="button"
											aria-pressed={all}
											onClick={() => pick(g.people)}
											className={cn(
												"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
												all ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
											)}
										>
											{all && <LuCheck className="size-3" />}
											{t(`groups.${g.key}`)} · {g.people.length}
										</button>
									);
								})}
							</div>
							{list.length >= SEARCH_FROM && (
								<div className="relative">
									<LuSearch className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
									<Input
										type="search"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder={t("search")}
										aria-label={t("search")}
										className="ps-8"
									/>
								</div>
							)}
							<ul className="divide-y overflow-hidden rounded-lg border" aria-describedby={errors.people ? "meeting-people-error" : undefined}>
								{shown.map((p) => {
									const checked = selected.has(p.id);
									return (
										<li key={p.id}>
											<label
												className={cn(
													"flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
													checked ? "bg-primary/5" : "hover:bg-muted/50",
												)}
											>
												<Checkbox checked={checked} onCheckedChange={(on) => toggle(p.id, on === true)} />
												<span
													aria-hidden="true"
													className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
												>
													{initials(p.name)}
												</span>
												<span className="grid min-w-0 flex-1">
													<span className="truncate text-sm font-medium">{p.name}</span>
													<span className="text-muted-foreground text-xs">{roles(p.role)}</span>
												</span>
											</label>
										</li>
									);
								})}
								{shown.length === 0 && (
									<li className="text-muted-foreground p-4 text-center text-sm">{t("noMatch")}</li>
								)}
							</ul>
						</>
					)}
					<FieldError id="meeting-people-error">{errors.people}</FieldError>
				</FieldSet>

				<FieldSet data-invalid={!!errors.when}>
					<FieldLegend variant="label">{t("when")}</FieldLegend>
					<div role="radiogroup" aria-label={t("when")} className="grid gap-2 sm:grid-cols-2">
						{(["now", "later"] as const).map((w) => {
							const Icon = w === "now" ? LuZap : LuCalendarClock;
							const on = when === w;
							return (
								<button
									key={w}
									type="button"
									role="radio"
									aria-checked={on}
									onClick={() => {
										setWhen(w);
										clear("when");
									}}
									className={cn(
										"flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
										on ? "border-primary bg-primary/5 ring-primary/20 ring-2" : "hover:bg-muted/50",
									)}
								>
									<Icon className={cn("mt-0.5 size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
									<span className="grid gap-0.5">
										<span className="text-sm font-medium">{t(`whenOptions.${w}.label`)}</span>
										<span className="text-muted-foreground text-xs">{t(`whenOptions.${w}.hint`)}</span>
									</span>
								</button>
							);
						})}
					</div>
					{when === "later" && (
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor="meeting-date">{t("date")}</FieldLabel>
								<Input
									id="meeting-date"
									type="date"
									value={date}
									min={format(new Date(), "yyyy-MM-dd")}
									onChange={(e) => {
										setDate(e.target.value);
										clear("when");
									}}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="meeting-time">{t("time")}</FieldLabel>
								<Input
									id="meeting-time"
									type="time"
									step={300}
									value={time}
									onChange={(e) => {
										setTime(e.target.value);
										clear("when");
									}}
								/>
							</Field>
						</div>
					)}
					<FieldError>{errors.when}</FieldError>
				</FieldSet>

				<div className="grid gap-5">
					<Field>
						<FieldLabel htmlFor="meeting-title">
							{t("subject")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
						</FieldLabel>
						<Input
							id="meeting-title"
							maxLength={120}
							placeholder={t("subjectPlaceholder")}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</Field>
					<FieldSet>
						<FieldLegend variant="label">{t("duration")}</FieldLegend>
						<div role="radiogroup" aria-label={t("duration")} className="flex">
							{MEETING_DURATIONS.map((d, i) => (
								<Button
									key={d}
									type="button"
									role="radio"
									aria-checked={duration === d}
									variant={duration === d ? "default" : "outline"}
									size="sm"
									onClick={() => setDuration(d)}
									className={cn(
										"h-9 tabular-nums",
										i === 0 ? "rounded-e-none" : i === MEETING_DURATIONS.length - 1 ? "-ms-px rounded-s-none" : "-ms-px rounded-none",
									)}
								>
									{t("minutes", { count: d })}
								</Button>
							))}
						</div>
					</FieldSet>
				</div>

			</div>
			<SheetFooter className="mt-0 items-center rounded-b-none px-5 sm:justify-between">
				{/* Beside the buttons, so it's seen whatever the scroll. */}
				{errors.form ? (
					<p role="alert" className="text-destructive text-sm sm:max-w-[55%]">
						{errors.form}
					</p>
				) : (
					<p className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
						<GoogleMark className="size-3.5" />
						<span dir="ltr">{google.data.connected && "email" in google.data ? google.data.email : null}</span>
					</p>
				)}
				<div className="flex gap-2">
					<Button type="button" variant="outline" onClick={onDone}>
						{t("cancel")}
					</Button>
					<Button type="submit" disabled={saving || list.length === 0}>
						{saving ? <LuLoader className="animate-spin" /> : when === "now" ? <LuVideo /> : <LuCalendarClock />}
						{when === "now" ? t("startNow") : t("plan")}
					</Button>
				</div>
			</SheetFooter>
		</form>
	);
}

/** Sends the owner to Google's consent screen; they come back to Paramètres. */
export function ConnectGoogleButton() {
	const t = useTranslations("settings.integrations");
	const [pending, setPending] = useState(false);
	return (
		<Button
			type="button"
			disabled={pending}
			onClick={async () => {
				setPending(true);
				try {
					const { url } = await api<{ url: string }>("/integrations/google/connect", { method: "POST" });
					window.location.assign(url);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : t("connectError"));
					setPending(false);
				}
			}}
		>
			{pending ? <LuLoader className="animate-spin" /> : <GoogleMark />}
			{t("google.connect")}
		</Button>
	);
}
