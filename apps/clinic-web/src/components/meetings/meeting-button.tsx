"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconVideo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NewMeetingSheet } from "./new-meeting-sheet";

/** The header's "Réunion": the responsible doctor starts one from any page. */
export function MeetingButton({ variant = "header" }: { variant?: "header" | "page" }) {
	const t = useTranslations("meetings");
	const [open, setOpen] = useState(false);
	return (
		<>
			{variant === "header" ? (
				<Button type="button" variant="outline" size="sm" className="hover:bg-brand/10 border border-brand/40 bg-brand/5 text-brand h-8 rounded-full !shadow-none" onClick={() => setOpen(true)} aria-label={t("newMeeting")}>
					<IconVideo />
					<span className="hidden lg:inline">{t("meeting")}</span>
				</Button>
			) : (
				<Button type="button" onClick={() => setOpen(true)}>
					<IconVideo /> {t("newMeeting")}
				</Button>
			)}
			<NewMeetingSheet open={open} onOpenChange={setOpen} />
		</>
	);
}
