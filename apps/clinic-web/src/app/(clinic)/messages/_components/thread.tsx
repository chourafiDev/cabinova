"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes, isSameDay } from "date-fns";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import { IconArrowLeft, IconSend, IconSpinner } from "@/components/icons";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	CHAT_KEY,
	type ChatMessage,
	type Conversation,
	type MessagePage,
	messagesKey,
	THREAD_POLL_MS,
} from "@/lib/chat";
import { initials } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { ConversationAvatar } from "./conversation-list";
import { useChatText } from "./use-chat-text";

const MAX_MESSAGE = 4000;
/** A colleague's messages this close together read as one run. */
const RUN_MINUTES = 5;

/** The open conversation: its header, its messages, and the composer. */
export function Thread({
	conversation,
	onBack,
	compact = false,
	actions,
}: {
	conversation: Conversation;
	onBack: () => void;
	/** In the floating panel: always one pane, so always a way back. */
	compact?: boolean;
	actions?: React.ReactNode;
}) {
	const text = useChatText();
	const t = useTranslations("chat");
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex items-center gap-3 border-b p-3">
				<Button variant="ghost" size="icon-sm" className={compact ? undefined : "md:hidden"} onClick={onBack} aria-label={t("back")}>
					<IconArrowLeft className="rtl:-scale-x-100" />
				</Button>
				<ConversationAvatar conversation={conversation} className="size-9" />
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-semibold">{text.title(conversation)}</h2>
					<p className="text-muted-foreground truncate text-xs">{text.subtitle(conversation)}</p>
				</div>
				{actions}
			</header>
			{/* Keyed: another conversation starts from its own end. */}
			<MessageScrollerProvider key={conversation.id} autoScroll defaultScrollPosition="end">
				<Messages conversation={conversation} />
				<Composer conversationId={conversation.id} />
			</MessageScrollerProvider>
		</div>
	);
}

function Messages({ conversation }: { conversation: Conversation }) {
	const t = useTranslations("chat");
	const text = useChatText();
	const fmt = useFormat();
	const me = useCurrentUser();
	const queryClient = useQueryClient();
	const { scrollToEnd } = useMessageScroller();
	// Older pages, loaded on demand above the latest one (which is polled).
	const [older, setOlder] = useState<ChatMessage[]>([]);
	const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
	const [loadingOlder, setLoadingOlder] = useState(false);

	const latest = useQuery({
		queryKey: messagesKey(conversation.id),
		queryFn: () => api<MessagePage>(`/chat/conversations/${conversation.id}/messages`),
		refetchInterval: THREAD_POLL_MS,
	});

	// What arrives while the conversation is open is read.
	const newest = latest.data?.messages.at(-1)?.id;
	useEffect(() => {
		if (!newest || conversation.unread === 0) return;
		void api(`/chat/conversations/${conversation.id}/read`, { method: "POST" })
			.then(() => queryClient.invalidateQueries({ queryKey: CHAT_KEY }))
			.catch(() => undefined);
	}, [newest, conversation.id, conversation.unread, queryClient]);

	// Opened: at the newest message (the scroller's own start position can miss it).
	const opened = useRef(false);
	useEffect(() => {
		if (latest.data && !opened.current) {
			opened.current = true;
			requestAnimationFrame(() => scrollToEnd({ behavior: "instant" }));
		}
	}, [latest.data, scrollToEnd]);

	const loadOlder = async () => {
		const first = older[0] ?? latest.data?.messages[0];
		if (!first) return;
		setLoadingOlder(true);
		try {
			const page = await api<MessagePage>(
				`/chat/conversations/${conversation.id}/messages?${new URLSearchParams({ before: first.createdAt })}`,
			);
			setOlder((list) => [...page.messages, ...list]);
			setOlderHasMore(page.hasMore);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("loadError"));
		} finally {
			setLoadingOlder(false);
		}
	};

	if (latest.isPending) {
		return (
			<div className="grid flex-1 content-end gap-3 p-4">
				<Skeleton className="h-10 w-2/3" />
				<Skeleton className="ms-auto h-10 w-1/2" />
				<Skeleton className="h-10 w-3/5" />
			</div>
		);
	}
	if (latest.isError) return <p className="text-destructive flex-1 p-4 text-sm">{t("loadError")}</p>;

	const seen = new Set(older.map((m) => m.id));
	const messages = [...older, ...latest.data.messages.filter((m) => !seen.has(m.id))];
	const hasMore = olderHasMore ?? latest.data.hasMore;
	const showNames = conversation.kind !== "direct";

	return (
		<MessageScroller className="min-h-0 flex-1">
			<MessageScrollerViewport preserveScrollOnPrepend aria-label={t("thread", { name: text.title(conversation) })}>
				<MessageScrollerContent className="gap-1 p-4">
					{hasMore && (
						<div className="flex justify-center pb-2">
							<Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
								{loadingOlder && <IconSpinner className="animate-spin" />} {t("loadOlder")}
							</Button>
						</div>
					)}
					{messages.length === 0 && (
						<p className="text-muted-foreground m-auto max-w-xs text-center text-sm">{t("firstMessage")}</p>
					)}
					{messages.map((m, i) => {
						const previous = messages[i - 1];
						const next = messages[i + 1];
						const newDay = !previous || !isSameDay(new Date(previous.createdAt), new Date(m.createdAt));
						const sameRun = (a?: ChatMessage, b?: ChatMessage) =>
							!!a && !!b && a.senderId === b.senderId && isSameDay(new Date(a.createdAt), new Date(b.createdAt)) &&
							Math.abs(differenceInMinutes(new Date(b.createdAt), new Date(a.createdAt))) < RUN_MINUTES;
						const startsRun = !sameRun(previous, m);
						const endsRun = !sameRun(m, next);
						const mine = m.senderId === me.id;
						return (
							<Fragment key={m.id}>
								{newDay && (
									<Marker variant="separator" className="py-3 text-xs">
										<MarkerContent className="first-letter:uppercase">{text.day(m.createdAt)}</MarkerContent>
									</Marker>
								)}
								<MessageScrollerItem messageId={m.id} className={startsRun && !newDay ? "pt-2" : undefined}>
									<Message align={mine ? "end" : "start"}>
										{!mine &&
											(endsRun ? (
												<MessageAvatar className="bg-primary/12 text-primary size-8 text-xs font-semibold" title={m.senderName}>
													{initials(m.senderName)}
												</MessageAvatar>
											) : (
												<span className="w-8 shrink-0" aria-hidden />
											))}
										<MessageContent className="gap-1">
											{showNames && !mine && startsRun && <MessageHeader>{m.senderName}</MessageHeader>}
											<Bubble variant={mine ? "default" : "muted"} align={mine ? "end" : "start"}>
												{/* Each message in its own direction: French in the Arabic app, and the reverse. */}
												<BubbleContent dir="auto" className="whitespace-pre-wrap">
													{m.body}
												</BubbleContent>
											</Bubble>
											{endsRun && (
												<MessageFooter className="font-normal tabular-nums">
													<time dateTime={m.createdAt}>{fmt.clock(m.createdAt)}</time>
												</MessageFooter>
											)}
										</MessageContent>
									</Message>
								</MessageScrollerItem>
							</Fragment>
						);
					})}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton aria-label={t("toLatest")} />
		</MessageScroller>
	);
}

/** Enter sends, Shift+Enter starts a new line. */
function Composer({ conversationId }: { conversationId: string }) {
	const t = useTranslations("chat");
	const queryClient = useQueryClient();
	const { scrollToEnd } = useMessageScroller();
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);

	const send = async () => {
		const text = body.trim();
		if (!text || sending) return;
		setSending(true);
		try {
			const message = await api<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
				method: "POST",
				body: JSON.stringify({ body: text }),
			});
			setBody("");
			queryClient.setQueryData<MessagePage>(messagesKey(conversationId), (page) =>
				page ? { ...page, messages: [...page.messages, message] } : page,
			);
			void queryClient.invalidateQueries({ queryKey: CHAT_KEY });
			requestAnimationFrame(() => scrollToEnd({ behavior: "smooth" }));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("sendError"));
		} finally {
			setSending(false);
		}
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void send();
			}}
			className="flex items-end gap-2 border-t p-3"
		>
			<Textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
						e.preventDefault();
						void send();
					}
				}}
				dir="auto"
				placeholder={t("placeholder")}
				aria-label={t("placeholder")}
				maxLength={MAX_MESSAGE}
				rows={1}
				className="max-h-40 min-h-9 resize-none"
			/>
			<Button type="submit" size="icon" className="h-9 w-10" disabled={!body.trim() || sending} aria-label={t("send")}>
				{sending ? <IconSpinner className="animate-spin" /> : <IconSend className="rtl:-scale-x-100" />}
			</Button>
		</form>
	);
}
