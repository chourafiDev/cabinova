"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { api } from "@/lib/api-client";
import { BADGE_POLL_MS, UNREAD_KEY } from "@/lib/chat";

/** Unread messages beside "Messages" in the sidebar (muted conversations aside). */
export function ChatBadge() {
	const t = useTranslations("chat");
	const { data } = useQuery({
		queryKey: UNREAD_KEY,
		queryFn: () => api<{ count: number }>("/chat/unread"),
		refetchInterval: BADGE_POLL_MS,
	});
	if (!data?.count) return null;
	return (
		<SidebarMenuBadge className="bg-primary text-primary-foreground! rounded-full" aria-label={t("unreadMessages", { count: data.count })}>
			{data.count > 99 ? "99+" : data.count}
		</SidebarMenuBadge>
	);
}
