"use client";

import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useState } from "react";
import { IconCalendar, IconClock, IconUserCheck } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Practitioner } from "@/lib/appointments";
import { SeenToday } from "./seen-today";
import { useWaiting } from "./use-today";
import { WaitingRoom } from "./waiting-room";

const TABS = ["waiting", "seen", "agenda"] as const;
type Tab = (typeof TABS)[number];

const searchParams = {
	tab: parseAsStringEnum<Tab>([...TABS]),
	// The agenda's own params: a link that sets one (dashboard, patient file) wants the agenda.
	view: parseAsString,
	date: parseAsString,
	book: parseAsString,
};

/** Waiting room first, then who was seen today, then the agenda. The tab lives in the URL. */
export function AppointmentsTabs({ agenda, practitioners }: { agenda: React.ReactNode; practitioners: Practitioner[] }) {
	const [{ tab, view, date, book }, setParams] = useQueryStates(searchParams, { history: "replace" });
	const { waiting, seen } = useWaiting();
	const t = useTranslations("agenda.tabs");
	// Decided on arrival: the agenda clearing its params (booking done, "today") keeps it open.
	const [arrival] = useState<Tab>(view || date || book ? "agenda" : "waiting");
	const current = tab ?? arrival;

	return (
		<Tabs value={current} onValueChange={(v) => setParams({ tab: v as Tab })} className="min-w-0 gap-4">
			<TabsList>
				<TabsTrigger value="waiting" className="px-3">
					<IconClock /> {t("waiting")}
					{waiting.length > 0 && (
						<span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
							{waiting.length}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="seen" className="px-3">
					<IconUserCheck /> {t("seen")}
					{seen.length > 0 && (
						<span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
							{seen.length}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="agenda" className="px-3">
					<IconCalendar /> {t("agenda")}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="waiting" className="min-w-0">
				<WaitingRoom practitioners={practitioners} />
			</TabsContent>
			<TabsContent value="seen" className="min-w-0">
				<SeenToday />
			</TabsContent>
			<TabsContent value="agenda" className="grid min-w-0 gap-3">
				{agenda}
			</TabsContent>
		</Tabs>
	);
}
