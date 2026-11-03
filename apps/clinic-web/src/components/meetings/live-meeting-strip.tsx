"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LuVideo } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { CURRENT_MEETINGS_KEY, type Meeting } from "@/lib/meetings";
import { useFormat } from "@/lib/use-format";

const POLL_MS = 30_000;

/**
 * Under the header on every page, for the people invited: the meeting
 * running now (or starting within ten minutes), one click from joining.
 */
export function LiveMeetingStrip() {
	const t = useTranslations("meetings.strip");
	const format = useFormat();
	const { data } = useQuery({
		queryKey: CURRENT_MEETINGS_KEY,
		queryFn: () => api<Meeting[]>("/meetings/current"),
		refetchInterval: POLL_MS,
	});
	// Re-rendered each 15 s: "starts at" turns into "running" on time.
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 15_000);
		return () => clearInterval(id);
	}, []);

	const meetings = (data ?? []).filter((m) => new Date(m.endsAt).getTime() > now);
	if (meetings.length === 0) return null;

	return (
		<div role="region" aria-label={t("label")} className="grid gap-px border-b">
			{meetings.map((m) => {
				const live = new Date(m.startsAt).getTime() <= now;
				return (
					<div
						key={m.id}
						className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50"
					>
						<span className="relative flex size-2.5 shrink-0" aria-hidden="true">
							{live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
							<span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
						</span>
						<p className="min-w-0 flex-1">
							<span className="font-medium">{live ? t("live") : t("soon", { time: format.clock(m.startsAt) })}</span>{" "}
							<span className="text-emerald-900/80 dark:text-emerald-100/80">
								· {m.title}
								{m.createdBy && ` · ${t("by", { name: m.createdBy.name })}`}
							</span>
						</p>
						<Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
							<a href={m.meetUrl} target="_blank" rel="noopener noreferrer">
								<LuVideo /> {t("join")}
							</a>
						</Button>
					</div>
				);
			})}
		</div>
	);
}
