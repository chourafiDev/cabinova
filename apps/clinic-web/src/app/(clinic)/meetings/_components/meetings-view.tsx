"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiVideoCamera } from "react-icons/hi2";
import { LuCalendarX, LuCopy, LuEllipsisVertical, LuLoader, LuUserPlus, LuVideo } from "react-icons/lu";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { initials } from "@/lib/format";
import {
	CURRENT_MEETINGS_KEY,
	type Meeting,
	type MeetingList,
	MEETINGS_KEY,
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

export function MeetingsView({ initial, isOwner }: { initial: MeetingList; isOwner: boolean }) {
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
						<h1 className="text-lg font-semibold leading-tight">{t("title")}</h1>
						<p className="text-muted-foreground text-sm">
							{live > 0 ? t("liveCount", { count: live }) : isOwner ? t("ownerHint") : t("staffHint")}
						</p>
					</div>
				</div>
				{isOwner && <MeetingButton variant="page" />}
			</header>

			<section className="grid gap-2" aria-labelledby="meetings-upcoming">
				<h2 id="meetings-upcoming" className="text-muted-foreground px-1 text-sm font-medium">
					{t("upcoming")}
				</h2>
				{data.upcoming.length === 0 ? (
					<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-12 text-center">
						<span className="bg-muted flex size-11 items-center justify-center rounded-full">
							<LuVideo className="text-muted-foreground size-5" />
						</span>
						<p className="font-medium">{t("empty")}</p>
						<p className="text-muted-foreground max-w-sm text-sm">{isOwner ? t("emptyOwner") : t("emptyStaff")}</p>
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
					<h2 id="meetings-past" className="text-muted-foreground px-1 text-sm font-medium">
						{t("past")}
					</h2>
					<ul className="bg-card divide-y overflow-hidden rounded-xl border">
						{data.past.map((m) => (
							<PastRow key={m.id} meeting={m} />
						))}
					</ul>
				</section>
			)}

			<AddPeopleDialog meeting={adding} onOpenChange={(o) => !o && setAdding(null)} />
			<CancelDialog meeting={cancelling} onOpenChange={(o) => !o && setCancelling(null)} />
		</div>
	);
}

function StatusBadge({ status }: { status: MeetingStatus }) {
	const t = useTranslations("meetings.status");
	return (
		<span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[status])}>
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

function People({ people, max = 5 }: { people: MeetingPerson[]; max?: number }) {
	const roles = useTranslations("common.roles");
	const shown = people.slice(0, max);
	return (
		<div className="flex items-center">
			<div className="flex -space-x-1.5 rtl:space-x-reverse">
				{shown.map((p) => (
					<Tooltip key={p.id}>
						<TooltipTrigger asChild>
							<span
								tabIndex={0}
								className="bg-muted ring-card flex size-7 items-center justify-center rounded-full text-[11px] font-semibold ring-2"
							>
								{initials(p.name)}
								<span className="sr-only">{p.name}</span>
							</span>
						</TooltipTrigger>
						<TooltipContent>
							{p.name} · {roles(p.role)}
						</TooltipContent>
					</Tooltip>
				))}
			</div>
			{people.length > max && <span className="text-muted-foreground ms-2 text-xs">+{people.length - max}</span>}
		</div>
	);
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
	const when = useWhen();
	const live = m.status === "live";
	const copy = async () => {
		await navigator.clipboard.writeText(m.meetUrl);
		toast.success(t("copied"));
	};

	return (
		<article
			className={cn(
				"bg-card grid h-full gap-4 rounded-xl border p-4",
				live && "border-emerald-300 ring-2 ring-emerald-500/15 dark:border-emerald-700",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="grid min-w-0 gap-1">
					<StatusBadge status={m.status} />
					<h3 className="truncate font-semibold">{m.title}</h3>
					<p className="text-muted-foreground text-sm first-letter:uppercase">{when(m)}</p>
				</div>
				{isOwner && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions")}>
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
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid gap-1">
					<People people={m.participants} />
					{m.createdBy && <p className="text-muted-foreground text-xs">{t("organizedBy", { name: m.createdBy.name })}</p>}
				</div>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t("copyLink")}>
						<LuCopy />
					</Button>
					<Button
						asChild
						variant={live ? "default" : "outline"}
						className={cn(live && "bg-emerald-600 text-white hover:bg-emerald-700")}
					>
						<a href={m.meetUrl} target="_blank" rel="noopener noreferrer">
							<LuVideo /> {t("join")}
						</a>
					</Button>
				</div>
			</div>
		</article>
	);
}

function PastRow({ meeting: m }: { meeting: Meeting }) {
	const t = useTranslations("meetings");
	const when = useWhen();
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div className="grid min-w-0 gap-0.5">
				<p className={cn("truncate text-sm font-medium", m.status === "cancelled" && "text-muted-foreground line-through")}>
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

function AddPeopleDialog({ meeting, onOpenChange }: { meeting: Meeting | null; onOpenChange: (open: boolean) => void }) {
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
					<DialogDescription>{t("hint", { title: meeting?.title ?? "" })}</DialogDescription>
				</DialogHeader>
				{people.isPending ? (
					<Skeleton className="h-32" />
				) : others.length === 0 ? (
					<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">{t("everyone")}</p>
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
										<span className="text-muted-foreground text-xs">{roles(p.role)}</span>
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
					<Button type="button" disabled={saving || selected.size === 0} onClick={save}>
						{saving ? <LuLoader className="animate-spin" /> : <LuUserPlus />}
						{t("submit", { count: selected.size })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CancelDialog({ meeting, onOpenChange }: { meeting: Meeting | null; onOpenChange: (open: boolean) => void }) {
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
					<DialogDescription>{t("hint", { count: meeting?.participants.length ?? 0 })}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						{t("keep")}
					</Button>
					<Button type="button" variant="destructive" disabled={saving} onClick={confirm}>
						{saving && <LuLoader className="animate-spin" />}
						{t("submit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
