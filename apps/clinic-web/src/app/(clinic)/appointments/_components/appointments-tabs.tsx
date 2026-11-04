"use client";

import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useState } from "react";
import { LuArmchair, LuCalendarDays } from "react-icons/lu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWaiting, WaitingRoom } from "./waiting-room";

const TABS = ["waiting", "agenda"] as const;
type Tab = (typeof TABS)[number];

const searchParams = {
	tab: parseAsStringEnum<Tab>([...TABS]),
	// The agenda's own params: a link that sets one (dashboard, patient file) wants the agenda.
	view: parseAsString,
	date: parseAsString,
	book: parseAsString,
};

/** Waiting room first, the agenda next to it. The tab lives in the URL. */
export function AppointmentsTabs({ agenda }: { agenda: React.ReactNode }) {
	const [{ tab, view, date, book }, setParams] = useQueryStates(searchParams, { history: "replace" });
	const { waiting } = useWaiting();
	const t = useTranslations("agenda.tabs");
	// Decided on arrival: the agenda clearing its params (booking done, "today") keeps it open.
	const [arrival] = useState<Tab>(view || date || book ? "agenda" : "waiting");
	const current = tab ?? arrival;

	return (
		<Tabs value={current} onValueChange={(v) => setParams({ tab: v as Tab })} className="min-w-0 gap-4">
			<TabsList>
				<TabsTrigger value="waiting" className="px-3">
					<LuArmchair /> {t("waiting")}
					{waiting.length > 0 && (
						<span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
							{waiting.length}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="agenda" className="px-3">
					<LuCalendarDays /> {t("agenda")}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="waiting" className="min-w-0">
				<WaitingRoom />
			</TabsContent>
			<TabsContent value="agenda" className="grid min-w-0 gap-3">
				{agenda}
			</TabsContent>
		</Tabs>
	);
}
