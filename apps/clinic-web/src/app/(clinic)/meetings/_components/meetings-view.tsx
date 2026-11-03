"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { HiVideoCamera } from "react-icons/hi2";
import {
	LuCalendarX,
	LuCheck,
	LuClock,
	LuCopy,
	LuEllipsisVertical,
	LuLink,
	LuLoader,
	LuUserPlus,
	LuVideo,
} from "react-icons/lu";
import { toast } from "sonner";
import { MeetingButton } from "@/components/meetings/meeting-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { initials } from "@/lib/format";
import {
	CURRENT_MEETINGS_KEY,
	MEETINGS_KEY,
	type Meeting,
	type MeetingList,
	type MeetingPerson,
	type MeetingStatus,
} from "@/lib/meetings";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<MeetingStatus, string> = {
	live: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
	upcoming: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
	ended: "bg-muted text-muted-foreground",
	cancelled: "bg-destructive/10 text-destructive",
};

export function MeetingsView({
	initial,
	isOwner,
}: {
	initial: MeetingList;
	isOwner: boolean;
}) {
	const t = useTranslations("meetings");
	const { data } = useQuery({
		queryKey: MEETINGS_KEY,
		queryFn: () => api<MeetingList>("/meetings"),
		initialData: initial,
		// "À venir" becomes "En cours" without a reload.
		refetchInterval: 60_000,
	});
	const [adding, setAdding] = useState<Meeting | null>(null);
	const [cancelling, setCancelling] = useState<Meeting | null>(null);
	const live = data.upcoming.filter((m) => m.status === "live").length;

	return (
		<div className="grid gap-5">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<HiVideoCamera className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">
							{t("title")}
						</h1>
						<p className="text-muted-foreground text-sm">
							{live > 0
								? t("liveCount", { count: live })
								: isOwner
									? t("ownerHint")
									: t("staffHint")}
						</p>
					</div>
				</div>
				{isOwner && <MeetingButton variant="page" />}
			</header>

			<section className="grid gap-2" aria-labelledby="meetings-upcoming">
				<h2
					id="meetings-upcoming"
					className="text-muted-foreground px-1 text-sm font-medium"
				>
					{t("upcoming")}
				</h2>
				{data.upcoming.length === 0 ? (
					<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-12 text-center">
						<span className="bg-muted flex size-11 items-center justify-center rounded-full">
							<LuVideo className="text-muted-foreground size-5" />
						</span>
						<p className="font-medium">{t("empty")}</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{isOwner ? t("emptyOwner") : t("emptyStaff")}
						</p>
						{isOwner && (
							<div className="mt-2">
								<MeetingButton variant="page" />
							</div>
						)}
					</div>
				) : (
					<ul className="grid gap-3 lg:grid-cols-2">
						{data.upcoming.map((m) => (
							<li key={m.id}>
								<MeetingCard
									meeting={m}
									isOwner={isOwner}
									onAdd={() => setAdding(m)}
									onCancel={() => setCancelling(m)}
								/>
							</li>
						))}
					</ul>
				)}
			</section>

			{data.past.length > 0 && (
				<section className="grid gap-2" aria-labelledby="meetings-past">
					<h2
						id="meetings-past"
						className="text-muted-foreground px-1 text-sm font-medium"
					>
						{t("past")}
					</h2>
					<ul className="bg-card divide-y overflow-hidden rounded-xl border">
						{data.past.map((m) => (
							<PastRow key={m.id} meeting={m} />
						))}
					</ul>
				</section>
			)}

			<AddPeopleDialog
				meeting={adding}
				onOpenChange={(o) => !o && setAdding(null)}
			/>
			<CancelDialog
				meeting={cancelling}
				onOpenChange={(o) => !o && setCancelling(null)}
			/>
		</div>
	);
}

function StatusBadge({ status }: { status: MeetingStatus }) {
	const t = useTranslations("meetings.status");
	return (
		<span
			className={cn(
				"inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
				STATUS_STYLES[status],
			)}
		>
			{status === "live" && (
				<span className="relative flex size-1.5" aria-hidden="true">
					<span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
					<span className="relative inline-flex size-1.5 rounded-full bg-current" />
				</span>
			)}
			{t(status)}
		</span>
	);
}

/** "Mardi 3 novembre · 10:00 – 10:30" */
function useWhen() {
	const format = useFormat();
	return (m: Meeting) =>
		`${format.date(m.startsAt, { weekday: "long", day: "numeric", month: "long", year: undefined })} · ${format.clock(m.startsAt)} – ${format.clock(m.endsAt)}`;
}

/** Same colour for the same person on every card. */
const AVATAR_TONES = [
	"bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
	"bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
	"bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
	"bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
	"bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
	"bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
];
const toneOf = (id: string) =>
	AVATAR_TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];

function Avatar({ person, className }: { person: MeetingPerson; className?: string }) {
	return (
		<span
			className={cn(
				"ring-card flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2",
				toneOf(person.id),
				className,
			)}
		>
			{initials(person.name)}
		</span>
	);
}

function People({ people, max = 4 }: { people: MeetingPerson[]; max?: number }) {
	const t = useTranslations("meetings.card");
	const roles = useTranslations("common.roles");
	const shown = people.slice(0, max);
	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<div className="flex -space-x-2 rtl:space-x-reverse">
				{shown.map((p) => (
					<Tooltip key={p.id}>
						<TooltipTrigger asChild>
							<span tabIndex={0} className="rounded-full">
								<Avatar person={p} />
								<span className="sr-only">{p.name}</span>
							</span>
						</TooltipTrigger>
						<TooltipContent>
							{p.name} · {roles(p.role)}
						</TooltipContent>
					</Tooltip>
				))}
				{people.length > max && (
					<span className="bg-muted text-muted-foreground ring-card flex size-8 items-center justify-center rounded-full text-[11px] font-semibold ring-2">
						+{people.length - max}
					</span>
				)}
			</div>
			<p className="text-muted-foreground truncate text-xs" aria-hidden="true">
				{people.length === 1
					? people[0].name
					: t("andOthers", { name: people[0]?.name ?? "", count: people.length - 1 })}
			</p>
		</div>
	);
}

/** Re-renders now and then: "dans 5 minutes" keeps counting down. */
function useNow(every = 30_000) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), every);
		return () => clearInterval(id);
	}, [every]);
	return now;
}

function MeetingCard({
	meeting: m,
	isOwner,
	onAdd,
	onCancel,
}: {
	meeting: Meeting;
	isOwner: boolean;
	onAdd: () => void;
	onCancel: () => void;
}) {
	const t = useTranslations("meetings");
	const card = useTranslations("meetings.card");
	const format = useFormat();
	const now = useNow();
	const [copied, setCopied] = useState(false);
	const start = new Date(m.startsAt).getTime();
	const end = new Date(m.endsAt).getTime();
	// The list is refetched each minute; between, the clock decides.
	const live = m.status === "live" || (start <= now && now < end);
	const minutes = Math.round((end - start) / 60_000);
	const copy = async () => {
		await navigator.clipboard.writeText(m.meetUrl);
		setCopied(true);
		toast.success(t("copied"));
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<article
			className={cn(
				"bg-card group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-[box-shadow,border-color] duration-200 hover:border-foreground/15 hover:shadow-md",
				live && "border-emerald-300 shadow-sm shadow-emerald-500/10 dark:border-emerald-700",
			)}
		>
			{/* Live: a thin accent along the top. */}
			{live && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />}

			<div className="flex flex-1 gap-4 p-4">
				{/* The day, like a calendar sheet. */}
				<div
					aria-hidden="true"
					className={cn(
						"flex w-14 shrink-0 flex-col items-center justify-center self-start overflow-hidden rounded-xl border text-center",
						live ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "bg-muted/40",
					)}
				>
					{live ? (
						<span className="flex h-[4.25rem] items-center justify-center">
							<span className="relative flex size-9 items-center justify-center rounded-full bg-emerald-600 text-white">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-40 motion-reduce:hidden" />
								<LuVideo className="relative size-4" />
							</span>
						</span>
					) : (
						<>
							<span className="bg-primary/10 text-primary w-full py-0.5 text-[10px] font-semibold tracking-wide uppercase">
								{format.date(m.startsAt, { month: "short", day: undefined, year: undefined })}
							</span>
							<span className="pt-1 text-xl leading-none font-semibold tabular-nums">
								{format.date(m.startsAt, { day: "numeric", month: undefined, year: undefined })}
							</span>
							<span className="text-muted-foreground pb-1.5 text-[10px] first-letter:uppercase">
								{format.date(m.startsAt, { weekday: "short", day: undefined, month: undefined, year: undefined })}
							</span>
						</>
					)}
				</div>

				<div className="grid min-w-0 flex-1 content-start gap-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
							<StatusBadge status={live ? "live" : m.status} />
							<span className={cn("text-xs", live ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
								{live ? card("endsIn", { ago: format.ago(m.endsAt) }) : card("startsIn", { ago: format.ago(m.startsAt) })}
							</span>
						</div>
						{isOwner && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground -me-1.5 -mt-1 opacity-70 group-hover:opacity-100 focus-visible:opacity-100"
										aria-label={t("actions")}
									>
										<LuEllipsisVertical />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-auto min-w-52 whitespace-nowrap">
									<DropdownMenuItem onSelect={onAdd}>
										<LuUserPlus /> {t("addPeople")}
									</DropdownMenuItem>
									<DropdownMenuItem variant="destructive" onSelect={onCancel}>
										<LuCalendarX /> {t("cancelMeeting")}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
					<h3 className="truncate text-base leading-snug font-semibold">{m.title}</h3>
					<p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span className="inline-flex items-center gap-1.5 tabular-nums">
							<LuClock className="size-3.5" />
							{format.clock(m.startsAt)} – {format.clock(m.endsAt)}
						</span>
						<span className="bg-muted rounded-md px-1.5 py-0.5 text-xs">{card("minutes", { count: minutes })}</span>
					</p>
					<div className="pt-1">
						<People people={m.participants} />
					</div>
				</div>
			</div>

			<footer className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
				<div className="grid min-w-0 gap-0.5">
					{m.createdBy && (
						<p className="text-muted-foreground truncate text-xs">{t("organizedBy", { name: m.createdBy.name })}</p>
					)}
					<p className="text-muted-foreground/80 flex items-center gap-1 truncate font-mono text-[11px]" dir="ltr">
						<LuLink className="size-3 shrink-0" />
						{m.meetUrl.replace(/^https?:\/\//, "")}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={copy}
								className="!shadow-none"
								aria-label={t("copyLink")}
							>
								{copied ? <LuCheck className="text-emerald-600" /> : <LuCopy />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{copied ? t("copied") : t("copyLink")}</TooltipContent>
					</Tooltip>
					<Button
						asChild
						variant={live ? "default" : "outline"}
						className={cn(live && "bg-emerald-600 text-white hover:bg-emerald-700", "!shadow-none h-8")}
					>
						<a href={m.meetUrl} target="_blank" rel="noopener noreferrer">
							<LuVideo /> {t("join")}
						</a>
					</Button>
				</div>
			</footer>
		</article>
	);
}

function PastRow({ meeting: m }: { meeting: Meeting }) {
	const t = useTranslations("meetings");
	const when = useWhen();
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div className="grid min-w-0 gap-0.5">
				<p
					className={cn(
						"truncate text-sm font-medium",
						m.status === "cancelled" && "text-muted-foreground line-through",
					)}
				>
					{m.title}
				</p>
				<p className="text-muted-foreground text-xs first-letter:uppercase">
					{when(m)} · {t("people", { count: m.participants.length })}
				</p>
			</div>
			<StatusBadge status={m.status} />
		</li>
	);
}

/** After a change: the page, the strip, and the server-rendered parts. */
function useRefresh() {
	const queryClient = useQueryClient();
	const router = useRouter();
	return () => {
		void queryClient.invalidateQueries({ queryKey: MEETINGS_KEY });
		void queryClient.invalidateQueries({ queryKey: CURRENT_MEETINGS_KEY });
		router.refresh();
	};
}

function AddPeopleDialog({
	meeting,
	onOpenChange,
}: {
	meeting: Meeting | null;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("meetings.add");
	const roles = useTranslations("common.roles");
	const refresh = useRefresh();
	const people = useQuery({
		queryKey: ["meetings", "people"],
		queryFn: () => api<MeetingPerson[]>("/meetings/people"),
		enabled: meeting !== null,
	});
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [saving, setSaving] = useState(false);
	const invited = new Set(meeting?.participants.map((p) => p.id));
	const others = (people.data ?? []).filter((p) => !invited.has(p.id));

	const close = (open: boolean) => {
		if (!open) setSelected(new Set());
		onOpenChange(open);
	};
	const save = async () => {
		if (!meeting) return;
		setSaving(true);
		try {
			await api(`/meetings/${meeting.id}/participants`, {
				method: "POST",
				body: JSON.stringify({ userIds: [...selected] }),
			});
			toast.success(t("done", { count: selected.size }));
			refresh();
			close(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={meeting !== null} onOpenChange={close}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>
						{t("hint", { title: meeting?.title ?? "" })}
					</DialogDescription>
				</DialogHeader>
				{people.isPending ? (
					<Skeleton className="h-32" />
				) : others.length === 0 ? (
					<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
						{t("everyone")}
					</p>
				) : (
					<ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
						{others.map((p) => (
							<li key={p.id}>
								<label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2.5">
									<Checkbox
										checked={selected.has(p.id)}
										onCheckedChange={(on) =>
											setSelected((s) => {
												const next = new Set(s);
												if (on === true) next.add(p.id);
												else next.delete(p.id);
												return next;
											})
										}
									/>
									<span className="grid">
										<span className="text-sm font-medium">{p.name}</span>
										<span className="text-muted-foreground text-xs">
											{roles(p.role)}
										</span>
									</span>
								</label>
							</li>
						))}
					</ul>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => close(false)}>
						{t("cancel")}
					</Button>
					<Button
						type="button"
						disabled={saving || selected.size === 0}
						onClick={save}
					>
						{saving ? <LuLoader className="animate-spin" /> : <LuUserPlus />}
						{t("submit", { count: selected.size })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CancelDialog({
	meeting,
	onOpenChange,
}: {
	meeting: Meeting | null;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("meetings.cancel");
	const refresh = useRefresh();
	const [saving, setSaving] = useState(false);
	const confirm = async () => {
		if (!meeting) return;
		setSaving(true);
		try {
			await api(`/meetings/${meeting.id}/cancel`, { method: "POST" });
			toast.success(t("done"));
			refresh();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	};
	return (
		<Dialog open={meeting !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>
						{t("hint", { count: meeting?.participants.length ?? 0 })}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						{t("keep")}
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={saving}
						onClick={confirm}
					>
						{saving && <LuLoader className="animate-spin" />}
						{t("submit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
