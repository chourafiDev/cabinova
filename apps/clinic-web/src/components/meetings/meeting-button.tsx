"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuVideo } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { NewMeetingDialog } from "./new-meeting-dialog";

/** The header's "Réunion": the responsible doctor starts one from any page. */
export function MeetingButton({ variant = "header" }: { variant?: "header" | "page" }) {
	const t = useTranslations("meetings");
	const [open, setOpen] = useState(false);
	return (
		<>
			{variant === "header" ? (
				<Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={t("newMeeting")}>
					<LuVideo />
					<span className="hidden lg:inline">{t("meeting")}</span>
				</Button>
			) : (
				<Button type="button" onClick={() => setOpen(true)}>
					<LuVideo /> {t("newMeeting")}
				</Button>
			)}
			<NewMeetingDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
