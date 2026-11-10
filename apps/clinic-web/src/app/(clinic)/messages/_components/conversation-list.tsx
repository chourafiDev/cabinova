"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	IconArchive,
	IconBuilding,
	IconChat,
	IconCheckDouble,
	IconMore,
	IconMute,
	IconPin,
	IconPinOff,
	IconPlus,
	IconRestore,
	IconSearch,
	IconUsers,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { CHAT_KEY, type Conversation } from "@/lib/chat";
import { fold, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChatText } from "./use-chat-text";

type Filter = "all" | "unread" | "groups" | "archived";

const FILTERS: Record<Filter, (c: Conversation) => boolean> = {
	all: (c) => !c.archived,
	unread: (c) => !c.archived && c.unread > 0,
	groups: (c) => !c.archived && c.kind !== "direct",
	archived: (c) => c.archived,
};

/**
 * The list pane: search, filters with their counts, and one row per
 * conversation (pinned first, as the API sorts them), each with its menu.
 */
export function ConversationList({
	conversations,
	openId,
	onOpen,
	onNew,
	actions,
}: {
	conversations: Conversation[] | undefined;
	openId: string | null;
	onOpen: (id: string) => void;
	onNew: () => void;
	/** After "Nouveau" (the floating panel's buttons). */
	actions?: React.ReactNode;
}) {
	const t = useTranslations("chat");
	const text = useChatText();
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");

	const all = conversations ?? [];
	const unreadTotal = all.filter((c) => !c.archived && !c.muted && c.unread > 0).length;
	const shown = all
		.filter(FILTERS[filter])
		.filter((c) => !query.trim() || fold(`${text.title(c)} ${c.members.map((m) => m.name).join(" ")}`).includes(fold(query.trim())));

	return (
		<div className="flex min-h-0 flex-col">
			<header className="flex items-center gap-1 border-b p-3">
				<h2 className="font-semibold">{t("title")}</h2>
				{unreadTotal > 0 && (
					<Badge variant="secondary" className="tabular-nums">
						{t("unreadCount", { count: unreadTotal })}
					</Badge>
				)}
				<Button size="sm" className="ms-auto" onClick={onNew}>
					<IconPlus /> {t("new")}
				</Button>
				{actions}
			</header>

			<div className="grid gap-2 border-b p-3">
				<div className="relative">
					<IconSearch className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("search")}
						aria-label={t("search")}
						className="h-9 ps-9"
					/>
				</div>
				<Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
					<TabsList className="w-full">
						{(Object.keys(FILTERS) as Filter[]).map((f) => (
							<TabsTrigger key={f} value={f} className="flex-1 gap-1 px-1.5 text-xs">
								{t(`filters.${f}`)}
								<span className="text-muted-foreground tabular-nums">{all.filter(FILTERS[f]).length}</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{!conversations ? (
					<div className="grid gap-2 p-3">
						{[0, 1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-14" />
						))}
					</div>
				) : shown.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 px-6 py-46 text-center">
						<IconChat className="text-muted-foreground size-8" />
						<p className="text-muted-foreground text-sm">{query.trim() ? t("noMatch") : t(`empty.${filter}`)}</p>
						{query.trim() && (
							<Button variant="ghost" size="sm" onClick={() => setQuery("")}>
								{t("clearSearch")}
							</Button>
						)}
					</div>
				) : (
					<ul className="divide-y">
						{shown.map((c) => (
							<ConversationRow key={c.id} conversation={c} open={c.id === openId} onOpen={() => onOpen(c.id)} />
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

/** The round mark of a conversation: a colleague's initials, a group, the cabinet. */
export function ConversationAvatar({ conversation, className }: { conversation: Conversation; className?: string }) {
	const text = useChatText();
	return (
		<span
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
				conversation.kind === "cabinet" ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary",
				className,
			)}
			aria-hidden
		>
			{conversation.kind === "cabinet" ? (
				<IconBuilding className="size-5" />
			) : conversation.kind === "group" ? (
				<IconUsers className="size-5" />
			) : (
				initials(text.title(conversation))
			)}
		</span>
	);
}

function ConversationRow({ conversation: c, open, onOpen }: { conversation: Conversation; open: boolean; onOpen: () => void }) {
	const t = useTranslations("chat");
	const text = useChatText();
	const queryClient = useQueryClient();

	const update = async (change: { pinned?: boolean; muted?: boolean; archived?: boolean }, done?: string) => {
		try {
			await api(`/chat/conversations/${c.id}`, { method: "PUT", body: JSON.stringify(change) });
			await queryClient.invalidateQueries({ queryKey: CHAT_KEY });
			if (done) {
				// Archiving hides the row: one click brings it back.
				toast.success(done, {
					action:
						change.archived === true
							? { label: t("undo"), onClick: () => void update({ archived: false }) }
							: undefined,
				});
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("actionError"));
		}
	};
	const markRead = async () => {
		await api(`/chat/conversations/${c.id}/read`, { method: "POST" }).catch(() => undefined);
		await queryClient.invalidateQueries({ queryKey: CHAT_KEY });
	};

	const state = [c.unread > 0 && t("rowUnread", { count: c.unread }), c.pinned && t("pinned"), c.muted && t("muted")]
		.filter(Boolean)
		.join(", ");

	return (
		<li className={cn("group/row relative flex items-center", open ? "bg-accent" : "hover:bg-muted/50")}>
			<button
				type="button"
				onClick={onOpen}
				aria-current={open || undefined}
				aria-label={state ? `${text.title(c)}, ${state}` : text.title(c)}
				className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start outline-none focus-visible:bg-muted"
			>
				<ConversationAvatar conversation={c} />
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5">
						<span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{text.title(c)}</span>
						{c.pinned && <IconPin className="text-muted-foreground size-3 shrink-0" />}
						{c.muted && <IconMute className="text-muted-foreground size-3.5 shrink-0" />}
						<span className="text-muted-foreground ms-auto shrink-0 text-xs tabular-nums">
							{text.when(c.lastMessage?.createdAt ?? c.createdAt)}
						</span>
					</span>
					<span className="flex items-center gap-2">
						<span
							dir="auto"
							className={cn("min-w-0 flex-1 truncate text-start text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}
						>
							{text.preview(c)}
						</span>
						{c.unread > 0 && (
							<span
								className={cn(
									"flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
									c.muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
								)}
							>
								{c.unread}
							</span>
						)}
					</span>
				</span>
			</button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("actions", { name: text.title(c) })}
						className="me-1 shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
					>
						<IconMore />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-52">
					<DropdownMenuItem onSelect={() => void update({ pinned: !c.pinned })}>
						{c.pinned ? <IconPinOff /> : <IconPin />} {c.pinned ? t("unpin") : t("pin")}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => void update({ muted: !c.muted })}>
						<IconMute /> {c.muted ? t("unmute") : t("mute")}
					</DropdownMenuItem>
					{c.unread > 0 && (
						<DropdownMenuItem onSelect={() => void markRead()}>
							<IconCheckDouble /> {t("markRead")}
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onSelect={() =>
							void update({ archived: !c.archived }, c.archived ? t("unarchived") : t("archived", { name: text.title(c) }))
						}
					>
						{c.archived ? <IconRestore /> : <IconArchive />} {c.archived ? t("unarchive") : t("archive")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
