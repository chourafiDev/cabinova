"use client";

import { moroccoHolidays } from "@cabinova/morocco-time";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	IconBuilding,
	IconCalendarEdit,
	IconFlag,
	IconPlus,
	IconSpinner,
	IconTrash,
	IconVacation,
	IconWarning,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { APPOINTMENTS_KEY, type Practitioner } from "@/lib/appointments";
import { CLOSURES_KEY, type Closure, canManage, dayKey, daysIn, KIND_ICONS } from "@/lib/closures";
import { initials } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ClosureSheet } from "./closure-sheet";

type User = { id: string; role: string };

/**
 * Congés et absences. Who is away and when, what still has to be moved,
 * and the public holidays coming. Recording days here closes them in the
 * agenda (for the whole cabinet, or for that doctor).
 */
export function AbsencesView({
	practitioners,
	user,
	openHolidays,
}: {
	practitioners: Practitioner[];
	user: User;
	/** The public holidays the cabinet works (keys). */
	openHolidays: string[];
}) {
	const t = useTranslations("absences");
	const [adding, setAdding] = useState(false);
	const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
	const canAdd = user.role !== "doctor" || practitioners.some((p) => p.id === user.id);

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<IconVacation className="size-4" />
					</span>
					<div>
						<h1 className="text-lg leading-tight font-semibold">{t("title")}</h1>
						<p className="text-muted-foreground text-sm">{t("subtitle")}</p>
					</div>
				</div>
				{canAdd && (
					<Button onClick={() => setAdding(true)}>
						<IconPlus /> {t("add")}
					</Button>
				)}
			</header>

			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
				<Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")} className="min-w-0 gap-3">
					<TabsList>
						<TabsTrigger value="upcoming" className="px-3">
							{t("tabs.upcoming")}
						</TabsTrigger>
						<TabsTrigger value="past" className="px-3">
							{t("tabs.past")}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="upcoming">
						<ClosureList when="upcoming" user={user} onAdd={canAdd ? () => setAdding(true) : undefined} />
					</TabsContent>
					<TabsContent value="past">
						<ClosureList when="past" user={user} />
					</TabsContent>
				</Tabs>

				<UpcomingHolidays openHolidays={openHolidays} owner={user.role === "owner"} />
			</div>

			<ClosureSheet open={adding} onOpenChange={setAdding} practitioners={practitioners} user={user} />
		</div>
	);
}

function ClosureList({ when, user, onAdd }: { when: "upcoming" | "past"; user: User; onAdd?: () => void }) {
	const t = useTranslations("absences");
	const { data, isPending, isError } = useQuery({
		queryKey: [...CLOSURES_KEY, when],
		queryFn: () => api<Closure[]>(`/closures?when=${when}`),
	});
	const [removing, setRemoving] = useState<Closure | null>(null);

	if (isPending) {
		return (
			<div className="grid gap-2">
				<Skeleton className="h-20 rounded-xl" />
				<Skeleton className="h-20 rounded-xl" />
			</div>
		);
	}
	if (isError) return <p className="text-destructive text-sm">{t("loadError")}</p>;
	if (data.length === 0) {
		return (
			<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
				<IconVacation className="text-muted-foreground size-6" />
				<p className="font-medium">{t(`empty.${when}`)}</p>
				{when === "upcoming" && <p className="text-muted-foreground max-w-sm text-sm">{t("empty.hint")}</p>}
				{onAdd && (
					<Button size="sm" variant="outline" className="mt-2" onClick={onAdd}>
						<IconPlus /> {t("add")}
					</Button>
				)}
			</div>
		);
	}
	return (
		<>
			<ul className="grid gap-2">
				{data.map((c) => (
					<ClosureRow key={c.id} closure={c} past={when === "past"} canRemove={canManage(user, c.practitionerId)} onRemove={() => setRemoving(c)} />
				))}
			</ul>
			<RemoveDialog closure={removing} onClose={() => setRemoving(null)} />
		</>
	);
}

function ClosureRow({
	closure: c,
	past,
	canRemove,
	onRemove,
}: {
	closure: Closure;
	past: boolean;
	canRemove: boolean;
	onRemove: () => void;
}) {
	const t = useTranslations("absences");
	const fmt = useFormat();
	const Icon = KIND_ICONS[c.kind];
	const today = dayKey(new Date());
	const ongoing = c.startsOn <= today && today <= c.endsOn;
	const days = daysIn(c.startsOn, c.endsOn);
	const single = c.startsOn === c.endsOn;
	const date = (day: string, withYear = false) =>
		fmt.date(`${day}T12:00:00`, { weekday: "short", day: "numeric", month: "short", year: withYear ? "numeric" : undefined });

	return (
		<li className={cn("bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4", past && "opacity-75")}>
			{c.practitionerId ? (
				<span className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold">
					{initials(c.practitionerName ?? "?")}
				</span>
			) : (
				<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
					<IconBuilding className="size-4" />
				</span>
			)}

			<div className="grid min-w-0 flex-1 gap-1">
				<p className="flex flex-wrap items-center gap-2 font-medium">
					<span className="truncate">{c.practitionerName ?? t("wholeCabinet")}</span>
					<Badge variant="secondary" className="gap-1">
						<Icon /> {t(`kinds.${c.kind}`)}
					</Badge>
					{ongoing && <Badge className="bg-emerald-100 text-emerald-800">{t("ongoing")}</Badge>}
				</p>
				<p className="text-muted-foreground text-sm first-letter:uppercase">
					{single ? date(c.startsOn, true) : t("range", { from: date(c.startsOn), to: date(c.endsOn, true) })}
					<span aria-hidden> · </span>
					{t("days", { count: days })}
				</p>
				{c.note && <p className="text-muted-foreground text-sm italic">{c.note}</p>}
			</div>

			<div className="flex items-center gap-2">
				{!past && c.appointments > 0 && (
					<Button asChild size="sm" variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100">
						<Link href={`/appointments?tab=agenda&view=week&date=${c.startsOn}`}>
							<IconWarning /> {t("toMove", { count: c.appointments })}
						</Link>
					</Button>
				)}
				{canRemove && (
					<Button size="icon-sm" variant="ghost" aria-label={t("remove")} onClick={onRemove}>
						<IconTrash />
					</Button>
				)}
			</div>
		</li>
	);
}

function RemoveDialog({ closure, onClose }: { closure: Closure | null; onClose: () => void }) {
	const t = useTranslations("absences");
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState(false);

	async function remove() {
		if (!closure) return;
		setBusy(true);
		try {
			await api(`/closures/${closure.id}`, { method: "DELETE" });
			toast.success(t("removed"));
			void queryClient.invalidateQueries({ queryKey: CLOSURES_KEY });
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("removeError"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog open={!!closure} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("removeTitle")}</DialogTitle>
					<DialogDescription>{t("removeDescription")}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						{t("cancel")}
					</Button>
					<Button variant="destructive" disabled={busy} onClick={remove}>
						{busy && <IconSpinner className="animate-spin" />}
						{t("remove")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** The next public holidays: closed for everyone (nothing to record), but the ones the cabinet works. */
function UpcomingHolidays({ openHolidays, owner }: { openHolidays: string[]; owner: boolean }) {
	const t = useTranslations("absences.holidays");
	const names = useTranslations("common.holidays");
	const fmt = useFormat();
	const today = dayKey(new Date());
	const year = new Date().getFullYear();
	// One line per holiday, its days together (the Aïds last two).
	const upcoming = [...moroccoHolidays(year), ...moroccoHolidays(year + 1)]
		.filter((h) => h.date >= today)
		.reduce<{ key: string; from: string; to: string; estimated: boolean }[]>((list, h) => {
			const last = list.at(-1);
			if (last && last.key === h.key && daysIn(last.to, h.date) === 2) last.to = h.date;
			else list.push({ key: h.key, from: h.date, to: h.date, estimated: h.estimated });
			return list;
		}, [])
		.slice(0, 6);
	const date = (day: string) => fmt.date(`${day}T12:00:00`, { weekday: "short", day: "numeric", month: "short", year: undefined });

	return (
		<section className="bg-card grid gap-3 rounded-xl border p-4" aria-label={t("title")}>
			<header className="flex items-center gap-2">
				<IconFlag className="text-muted-foreground size-4" />
				<h2 className="text-sm font-semibold">{t("title")}</h2>
			</header>
			<p className="text-muted-foreground text-xs">{t("hint")}</p>
			<ul className="grid gap-2.5">
				{upcoming.map((h) => (
					<li key={h.from} className="flex items-start justify-between gap-3 text-sm">
						<span className="min-w-0">
							<span className={cn("font-medium", openHolidays.includes(h.key) && "text-muted-foreground")}>
								{names(`names.${h.key}`)}
							</span>
							{openHolidays.includes(h.key) && (
								<span className="text-muted-foreground block text-xs">{names("worked")}</span>
							)}
							{h.estimated && <span className="text-muted-foreground block text-xs">{t("estimated")}</span>}
						</span>
						<span className="text-muted-foreground shrink-0 text-end text-xs first-letter:uppercase">
							{h.from === h.to ? date(h.from) : `${date(h.from)} – ${date(h.to)}`}
						</span>
					</li>
				))}
			</ul>
			<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
				<IconCalendarEdit className="size-3.5" /> {t("closedInAgenda")}
				{owner && (
					<Link href="/settings/hours#holidays" className="text-foreground ms-auto font-medium hover:underline">
						{t("manage")}
					</Link>
				)}
			</p>
		</section>
	);
}
