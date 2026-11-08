"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { IconChat } from "@/components/icons";
import { api } from "@/lib/api-client";
import { type Conversation, CONVERSATIONS_KEY, LIST_POLL_MS } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";
import { NewConversationDialog } from "./new-conversation-dialog";
import { Thread } from "./thread";

/**
 * Messages: the staff's conversations beside the open one (?c=). On a
 * phone, one pane at a time.
 */
export function MessagesView() {
	const t = useTranslations("chat");
	const [openId, setOpenId] = useQueryState("c", parseAsString.withOptions({ history: "replace" }));
	const [creating, setCreating] = useState(false);
	const conversations = useQuery({
		queryKey: CONVERSATIONS_KEY,
		queryFn: () => api<Conversation[]>("/chat/conversations"),
		refetchInterval: LIST_POLL_MS,
	});
	const open = conversations.data?.find((c) => c.id === openId) ?? null;

	return (
		<div className="bg-card grid h-[calc(100svh-7.5rem)] min-h-[480px] overflow-hidden rounded-xl border grid-cols-1 md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
			<h1 className="sr-only">{t("title")}</h1>
			<div className={cn("min-h-0 min-w-0 md:flex md:border-e", open ? "hidden" : "flex")}>
				<div className="flex min-h-0 w-full flex-col">
					<ConversationList
						conversations={conversations.data}
						openId={openId}
						onOpen={(id) => void setOpenId(id)}
						onNew={() => setCreating(true)}
					/>
				</div>
			</div>
			<div className={cn("min-h-0 min-w-0 md:flex md:flex-col", open ? "flex flex-col" : "hidden")}>
				{open ? (
					<Thread key={open.id} conversation={open} onBack={() => void setOpenId(null)} />
				) : (
					<div className="text-muted-foreground m-auto flex max-w-xs flex-col items-center gap-2 p-6 text-center">
						<IconChat className="size-8" />
						<p className="text-foreground font-medium">{t("noneOpen")}</p>
						<p className="text-sm">{t("noneOpenHint")}</p>
					</div>
				)}
			</div>
			<NewConversationDialog open={creating} onOpenChange={setCreating} onCreated={(id) => void setOpenId(id)} />
		</div>
	);
}
