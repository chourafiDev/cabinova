"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconChat } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { BADGE_POLL_MS, UNREAD_KEY } from "@/lib/chat";

/** Messages, from the header: the unread count like the bell's, a click opens the page. */
export function ChatHeaderButton() {
	const t = useTranslations("chat");
	const { data } = useQuery({
		queryKey: UNREAD_KEY,
		queryFn: () => api<{ count: number }>("/chat/unread"),
		refetchInterval: BADGE_POLL_MS,
	});
	const unread = data?.count ?? 0;
	return (
		<Button
			asChild
			variant="outline"
			size="sm"
			className="hover:bg-green/10 border border-green/40 bg-green/5 text-green h-8 rounded-full !shadow-none"
			aria-label={
				unread
					? `${t("title")} · ${t("unreadMessages", { count: unread })}`
					: t("title")
			}
			title={t("title")}
		>
			<Link href="/messages">
				<IconChat />
				Inbox
				{unread < 0 && (
					<span className="bg-primary text-primary-foreground absolute -end-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
						{unread > 9 ? "9+" : unread} 2
					</span>
				)}
			</Link>
		</Button>
	);
}
