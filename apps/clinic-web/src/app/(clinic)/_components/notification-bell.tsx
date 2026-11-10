"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { arMA, fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
	type AppIcon,
	IconBell,
	IconCalendarRemove,
	IconCheckDouble,
	IconLogin,
	IconReceipt,
	IconUserAdd,
	IconUserRemove,
	IconVideo,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

type Notification = {
	id: string;
	kind: "arrived" | "no_show" | "cancelled" | "team" | "billing" | "meeting";
	title: string;
	body: string | null;
	/** Absent on notifications written before they were translated. */
	code: string | null;
	params: Record<string, string | number | null> | null;
	href: string | null;
	readAt: string | null;
	createdAt: string;
};
type Inbox = { data: Notification[]; unread: number };

const KEY = ["notifications"];
const POLL_MS = 60_000;

const ICONS: Record<Notification["kind"], AppIcon> = {
	arrived: IconLogin,
	no_show: IconUserRemove,
	cancelled: IconCalendarRemove,
	team: IconUserAdd,
	billing: IconReceipt,
	meeting: IconVideo,
};

/** The header's bell: what needs this person's attention, checked every minute. */
export function NotificationBell() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const t = useTranslations("common.notifications");
	const dateLocale = useLocale() === "ar" ? arMA : fr;
	const format = useFormat();
	const titleOf = (n: Notification) =>
		n.code && t.has(`codes.${n.code}`)
			? t(
					`codes.${n.code}`,
					(n.params ?? {}) as Record<string, string | number>,
				)
			: n.title;
	const detailOf = ({ kind, params, body }: Notification) => {
		if (kind === "meeting" && typeof params?.time === "string") {
			if (params.now) return t("meetingNow", { title: String(params.title) });
			const date = format.date(`${params.day}T12:00:00Z`, {
				weekday: "long",
				month: "long",
				year: undefined,
			});
			return t("meetingAt", {
				title: String(params.title),
				date,
				time: params.time,
			});
		}
		if (typeof params?.amount === "number") return format.mad(params.amount);
		if (typeof params?.time === "string") {
			return [params.walkIn ? t("walkIn") : t("appointmentAt", { time: params.time }), params.space]
				.filter(Boolean)
				.join(" · ");
		}
		return body;
	};
	const { data } = useQuery({
		queryKey: KEY,
		queryFn: () => api<Inbox>("/notifications"),
		refetchInterval: POLL_MS,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
	/** Read at once on screen; the next refresh says what the server kept. */
	const markRead = (ids: string[] | "all") => {
		const now = new Date().toISOString();
		queryClient.setQueryData<Inbox>(KEY, (inbox) => {
			if (!inbox) return inbox;
			const data = inbox.data.map((n) =>
				!n.readAt && (ids === "all" || ids.includes(n.id))
					? { ...n, readAt: now }
					: n,
			);
			const marked = data.filter((n, i) => n !== inbox.data[i]).length;
			return {
				data,
				unread: ids === "all" ? 0 : Math.max(0, inbox.unread - marked),
			};
		});
	};
	const readAll = useMutation({
		mutationFn: () => api("/notifications/read", { method: "POST" }),
		onMutate: () => markRead("all"),
		onSettled: refresh,
	});
	const unread = data?.unread ?? 0;

	const select = (n: Notification) => {
		setOpen(false);
		if (!n.readAt) {
			markRead([n.id]);
			void api(`/notifications/${n.id}/read`, { method: "POST" }).then(
				refresh,
				refresh,
			);
		}
		if (n.href) router.push(n.href);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="relative !shadow-none"
					aria-label={unread ? t("unread", { count: unread }) : t("title")}
				>
					<IconBell />
					{unread > 0 && (
						<span className="bg-primary text-primary-foreground absolute -end-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
							{unread > 9 ? "9+" : unread}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
			>
				<header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
					<h2 className="font-semibold">{t("title")}</h2>
					{unread > 0 && (
						<Button
							size="sm"
							variant="ghost"
							className="-me-2 h-7"
							disabled={readAll.isPending}
							onClick={() => readAll.mutate()}
						>
							<IconCheckDouble /> {t("readAll")}
						</Button>
					)}
				</header>
				{data?.data.length ? (
					<ul className="max-h-[26rem] divide-y overflow-y-auto">
						{data.data.map((n) => {
							const Icon = ICONS[n.kind];
							return (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => select(n)}
										className={cn(
											"hover:bg-muted/60 flex w-full items-start gap-3 px-4 py-3 text-start",
											!n.readAt && "bg-primary/5",
										)}
									>
										<span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
											<Icon className="size-4" />
										</span>
										<span className="grid min-w-0 flex-1 gap-0.5">
											<span
												className={cn("text-sm", !n.readAt && "font-medium")}
											>
												{titleOf(n)}
											</span>
											<span className="text-muted-foreground text-xs">
												{[
													detailOf(n),
													formatDistanceToNow(new Date(n.createdAt), {
														locale: dateLocale,
														addSuffix: true,
													}),
												]
													.filter(Boolean)
													.join(" · ")}
											</span>
										</span>
										{!n.readAt && (
											<span
												className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
												aria-label={t("unreadDot")}
											/>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-muted-foreground px-4 py-10 text-center text-sm">
						{t("empty")}
					</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
