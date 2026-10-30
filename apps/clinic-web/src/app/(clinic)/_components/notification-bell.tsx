"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IconType } from "react-icons";
import { LuBell, LuCalendarX, LuCheckCheck, LuDoorOpen, LuReceipt, LuUserPlus, LuUserX } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Notification = {
	id: string;
	kind: "arrived" | "no_show" | "cancelled" | "team" | "billing";
	title: string;
	body: string | null;
	href: string | null;
	readAt: string | null;
	createdAt: string;
};
type Inbox = { data: Notification[]; unread: number };

const KEY = ["notifications"];
const POLL_MS = 60_000;

const ICONS: Record<Notification["kind"], IconType> = {
	arrived: LuDoorOpen,
	no_show: LuUserX,
	cancelled: LuCalendarX,
	team: LuUserPlus,
	billing: LuReceipt,
};

/** The header's bell: what needs this person's attention, checked every minute. */
export function NotificationBell() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const { data } = useQuery({
		queryKey: KEY,
		queryFn: () => api<Inbox>("/notifications"),
		refetchInterval: POLL_MS,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
	const readAll = useMutation({
		mutationFn: () => api("/notifications/read", { method: "POST" }),
		onSuccess: refresh,
	});
	const unread = data?.unread ?? 0;

	const select = (n: Notification) => {
		setOpen(false);
		if (!n.readAt) void api(`/notifications/${n.id}/read`, { method: "POST" }).then(refresh);
		if (n.href) router.push(n.href);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size="icon"
					variant="ghost"
					className="relative"
					aria-label={unread ? `Notifications, ${unread} non lues` : "Notifications"}
				>
					<LuBell />
					{unread > 0 && (
						<span className="bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
							{unread > 9 ? "9+" : unread}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
				<header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
					<h2 className="font-semibold">Notifications</h2>
					{unread > 0 && (
						<Button size="sm" variant="ghost" className="-me-2 h-7" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
							<LuCheckCheck /> Tout marquer comme lu
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
										className={cn("hover:bg-muted/60 flex w-full items-start gap-3 px-4 py-3 text-start", !n.readAt && "bg-primary/5")}
									>
										<span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
											<Icon className="size-4" />
										</span>
										<span className="grid min-w-0 flex-1 gap-0.5">
											<span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
											<span className="text-muted-foreground text-xs">
												{[n.body, formatDistanceToNow(new Date(n.createdAt), { locale: fr, addSuffix: true })]
													.filter(Boolean)
													.join(" · ")}
											</span>
										</span>
										{!n.readAt && <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-label="Non lue" />}
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-muted-foreground px-4 py-10 text-center text-sm">Aucune notification pour le moment.</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
