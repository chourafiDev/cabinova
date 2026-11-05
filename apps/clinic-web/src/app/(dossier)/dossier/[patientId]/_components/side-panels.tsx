"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuHourglass } from "react-icons/lu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment } from "@/lib/appointments";
import type { Prescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { useConsultationDraft } from "./consultation-workspace";

/** A box of the right column: a few short tabs, one shown at a time. */
export function TabBox({ tabs }: { tabs: { value: string; label: string; content: React.ReactNode }[] }) {
	const [tab, setTab] = useState(tabs[0].value);
	return (
		<Tabs value={tab} onValueChange={setTab} className="bg-card gap-0 rounded-xl border">
			<div className="overflow-x-auto border-b p-1.5">
				<TabsList className="w-full min-w-max">
					{tabs.map((t) => (
						<TabsTrigger key={t.value} value={t.value} className="px-2 text-xs">
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			{tabs.map((t) => (
				<TabsContent key={t.value} value={t.value} className="p-3">
					{t.content}
				</TabsContent>
			))}
		</Tabs>
	);
}

/** Today's visit at a glance, from what is being written. */
export function VisitSummary({ appointment, prescription }: { appointment: Appointment; prescription: Prescription | null }) {
	const t = useTranslations("dossier");
	const format = useFormat();
	const draft = useConsultationDraft();
	const rows = [
		[t("summary.visit"), appointment.walkIn ? t("walkIn") : t("appointmentAt", { time: format.clock(appointment.startsAt) })],
		[t("summary.act"), appointment.reason],
		[t("fields.complaint"), draft?.complaint],
		[t("sections.diagnosis"), draft?.diagnosis],
		[t("summary.prescription"), t("summary.lines", { count: prescription?.items.length ?? 0 })],
	] as const;
	return (
		<dl className="grid gap-2.5 text-sm">
			{rows.map(([label, value]) => (
				<div key={label} className="grid gap-0.5">
					<dt className="text-muted-foreground text-xs">{label}</dt>
					<dd className="line-clamp-3 whitespace-pre-line">{value || "—"}</dd>
				</div>
			))}
		</dl>
	);
}

/** The medications of today's ordonnance, as last saved. */
export function Medications({ prescription }: { prescription: Prescription | null }) {
	const t = useTranslations("dossier.summary");
	if (!prescription?.items.length) return <p className="text-muted-foreground text-xs">{t("noMedication")}</p>;
	return (
		<ol className="grid gap-2 text-sm">
			{prescription.items.map((item, i) => (
				<li key={`${i}-${item.medication}`} className="grid gap-0.5">
					<p className="font-medium">{item.medication}</p>
					{(item.posology || item.duration) && (
						<p className="text-muted-foreground text-xs">{[item.posology, item.duration].filter(Boolean).join(" · ")}</p>
					)}
				</li>
			))}
		</ol>
	);
}

/** A part of the dossier not built yet: what it will hold. */
export function Planned({ fields }: { fields: string[] }) {
	const t = useTranslations("dossier.planned");
	return (
		<div className="bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
			<span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
				<LuHourglass className="size-4" />
			</span>
			<p className="text-sm font-medium">{t("title")}</p>
			{fields.length > 0 && <p className="text-muted-foreground max-w-md text-xs">{fields.join(" · ")}</p>}
		</div>
	);
}
