"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconChat, IconClose, IconExternal } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { type Conversation, CONVERSATIONS_KEY, LIST_POLL_MS, UNREAD_KEY, BADGE_POLL_MS } from "@/lib/chat";
import { ConversationList } from "../messages/_components/conversation-list";
import { NewConversationDialog } from "../messages/_components/new-conversation-dialog";
import { Thread } from "../messages/_components/thread";

/**
 * The chat from any page: a round button bottom-end, with the unread count,
 * opening the conversations in a panel above it. Not on the Messages page.
 */
export function ChatLauncher() {
	const t = useTranslations("chat");
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const unread = useQuery({
		queryKey: UNREAD_KEY,
		queryFn: () => api<{ count: number }>("/chat/unread"),
		refetchInterval: BADGE_POLL_MS,
	});
	const conversations = useQuery({
		queryKey: CONVERSATIONS_KEY,
		queryFn: () => api<Conversation[]>("/chat/conversations"),
		refetchInterval: LIST_POLL_MS,
		enabled: open,
	});
	if (pathname.startsWith("/messages")) return null;

	const current = conversations.data?.find((c) => c.id === openId) ?? null;
	const count = unread.data?.count ?? 0;
	const panelButtons = (href: string) => (
		<>
			<Button asChild variant="outline" size="icon-sm" aria-label={t("openPage")} title={t("openPage")}>
				<Link href={href} onClick={() => setOpen(false)}>
					<IconExternal />
				</Link>
			</Button>
			<Button variant="ghost" size="icon-sm" aria-label={t("close")} title={t("close")} onClick={() => setOpen(false)}>
				<IconClose />
			</Button>
		</>
	);

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						size="icon"
						aria-label={count ? `${t("title")} · ${t("unreadMessages", { count })}` : t("title")}
						className="fixed end-5 bottom-5 z-40 size-12 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6"
					>
						<IconChat />
						{count > 0 && (
							<span
								aria-hidden
								className="bg-destructive ring-background absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white tabular-nums ring-2"
							>
								{count > 99 ? "99+" : count}
							</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="end"
					sideOffset={12}
					className="flex h-[min(600px,calc(100svh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
				>
					{current ? (
						<Thread
							key={current.id}
							conversation={current}
							compact
							onBack={() => setOpenId(null)}
							actions={panelButtons(`/messages?c=${current.id}`)}
						/>
					) : (
						<ConversationList
							conversations={conversations.data}
							openId={null}
							onOpen={setOpenId}
							onNew={() => setCreating(true)}
							actions={panelButtons("/messages")}
						/>
					)}
				</PopoverContent>
			</Popover>
			<NewConversationDialog
				open={creating}
				onOpenChange={setCreating}
				onCreated={(id) => {
					setOpenId(id);
					setOpen(true);
				}}
			/>
		</>
	);
}
