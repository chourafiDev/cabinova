"use client";

import { LuBell, LuCheckCheck, LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { type AppNotification, type NotificationList, type NotificationSeverity, timeAgo } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const SEVERITY: Record<NotificationSeverity, { icon: typeof LuBell; tone: string }> = {
	critical: { icon: LuCircleAlert, tone: "bg-red-50 text-red-700" },
	warning: { icon: LuTriangleAlert, tone: "bg-amber-50 text-amber-800" },
	info: { icon: LuInfo, tone: "bg-sky-50 text-sky-700" },
	success: { icon: LuCircleCheck, tone: "bg-emerald-50 text-emerald-700" },
};

/**
 * The bell: unread count, the last 30 notifications, and live delivery over
 * Server-Sent Events. New critical/warning ones also pop up as a toast. The
 * list is refetched whenever the stream (re)connects, so nothing sent while
 * offline is missed.
 */
export function NotificationsBell() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[]>([]);
	const [unread, setUnread] = useState(0);
	const [now, setNow] = useState(() => Date.now());

	const load = useCallback(() => {
		api<NotificationList>("/notifications")
			.then((r) => {
				setItems(r.data);
				setUnread(r.unread);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		const source = new EventSource("/api/notifications/stream");
		source.onopen = load;
		source.addEventListener("notification", (e) => {
			const n = JSON.parse((e as MessageEvent).data) as AppNotification;
			setItems((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, 30));
			setUnread((u) => u + 1);
			if (n.severity === "critical" || n.severity === "warning") {
				const show = n.severity === "critical" ? toast.error : toast.warning;
				show(n.title, {
					description: n.body ?? undefined,
					...(n.href && { action: { label: "Ouvrir", onClick: () => router.push(n.href!) } }),
				});
			}
		});
		const tick = setInterval(() => setNow(Date.now()), 60_000);
		return () => {
			source.close();
			clearInterval(tick);
		};
	}, [load, router]);

	const markRead = (ids: string[] | "all") =>
		api<NotificationList>(ids === "all" ? "/notifications/read-all" : "/notifications/read", {
			method: "POST",
			...(ids !== "all" && { body: JSON.stringify({ ids }) }),
		})
			.then((r) => {
				setItems(r.data);
				setUnread(r.unread);
			})
			.catch(() => {});

	const openItem = (n: AppNotification) => {
		if (!n.readAt) void markRead([n.id]);
		setOpen(false);
		if (n.href) router.push(n.href);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) setNow(Date.now());
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="relative"
					aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
				>
					<LuBell />
					{unread > 0 && (
						<span className="absolute -end-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
							{unread > 99 ? "99+" : unread}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
				<div className="flex items-center justify-between border-b px-3 py-2">
					<span className="text-sm font-semibold">
						Notifications
						{unread > 0 && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{unread} non lue{unread > 1 ? "s" : ""}</span>}
					</span>
					{unread > 0 && (
						<Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markRead("all")}>
							<LuCheckCheck /> Tout marquer comme lu
						</Button>
					)}
				</div>
				{items.length === 0 ? (
					<p className="px-3 py-10 text-center text-sm text-muted-foreground">Aucune notification pour l’instant.</p>
				) : (
					<ul className="max-h-[min(440px,70vh)] divide-y p-1 overflow-y-auto">
						{items.map((n) => {
							const s = SEVERITY[n.severity];
							return (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => openItem(n)}
										className={cn(
											"flex w-full gap-3 my-1 px-3 py-2.5 text-start rounded-md hover:bg-muted",
											!n.readAt && "bg-primary/[0.03]",
										)}
									>
										<span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", s.tone)}>
											<s.icon className="size-3.5" />
										</span>
										<span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
											<span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
											{n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
											<span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt, now)}</span>
										</span>
										{!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
