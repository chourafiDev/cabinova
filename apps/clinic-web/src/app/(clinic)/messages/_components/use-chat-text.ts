"use client";

import { differenceInCalendarDays } from "date-fns";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/components/current-user";
import type { Conversation } from "@/lib/chat";
import { useFormat } from "@/lib/use-format";

/** How a conversation reads in the list and the thread's header. */
export function useChatText() {
	const t = useTranslations("chat");
	const roles = useTranslations("common.roles");
	const fmt = useFormat();
	const me = useCurrentUser();

	const title = (c: Conversation) =>
		c.kind === "cabinet" ? t("cabinetRoom") : c.kind === "group" ? (c.name ?? t("group")) : (c.members[0]?.name ?? t("formerColleague"));

	return {
		title,
		/** Under the title: a colleague's role, a group's members, the cabinet's size. */
		subtitle: (c: Conversation) =>
			c.kind === "direct"
				? c.members[0] && (c.members[0].active ? roles(c.members[0].role) : t("inactive"))
				: c.kind === "group"
					? [t("you"), ...c.members.map((m) => m.name)].join(", ")
					: t("everyone", { count: c.members.length + 1 }),
		/** The last message, "Vous : …" when it is one's own, its author in a group. */
		preview: (c: Conversation) => {
			const last = c.lastMessage;
			if (!last) return t("noMessage");
			const body = last.body.replace(/\s+/g, " ");
			if (last.senderId === me.id) return `${t("youPrefix")} ${body}`;
			return c.kind === "direct" ? body : `${last.senderName.split(" ")[0]} : ${body}`;
		},
		/** A row's time: the hour today, "Hier", the weekday this week, else the date. */
		when: (iso: string) => {
			const days = differenceInCalendarDays(new Date(), new Date(iso));
			if (days === 0) return fmt.clock(iso);
			if (days === 1) return t("yesterday");
			if (days < 7) return fmt.date(iso, { weekday: "short", day: undefined, month: undefined, year: undefined });
			return fmt.date(iso, { day: "numeric", month: "short", year: undefined });
		},
		/** A day separator in the thread. */
		day: (iso: string) => {
			const days = differenceInCalendarDays(new Date(), new Date(iso));
			if (days === 0) return t("today");
			if (days === 1) return t("yesterday");
			return fmt.date(iso, { weekday: "long", day: "numeric", month: "long" });
		},
	};
}
