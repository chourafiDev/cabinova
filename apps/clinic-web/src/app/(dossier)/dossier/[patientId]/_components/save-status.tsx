"use client";

import { useTranslations } from "next-intl";
import { IconAlertCircle, IconCloud, IconSpinner } from "@/components/icons";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

export type SaveState =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "saved"; at: string }
	| { status: "error" };

/** Quiet, always in the same place: the doctor never wonders whether the notes are kept. */
export function SaveStatus({ state }: { state: SaveState }) {
	const t = useTranslations("dossier.save");
	const format = useFormat();
	if (state.status === "idle") return null;
	return (
		<span
			role="status"
			className={cn(
				"flex items-center gap-1.5 text-xs",
				state.status === "error" ? "text-destructive" : "text-muted-foreground",
			)}
		>
			{state.status === "saving" ? (
				<>
					<IconSpinner className="size-3.5 animate-spin" /> {t("saving")}
				</>
			) : state.status === "saved" ? (
				<>
					<IconCloud className="size-3.5" /> {t("saved", { time: format.clock(state.at) })}
				</>
			) : (
				<>
					<IconAlertCircle className="size-3.5" /> {t("error")}
				</>
			)}
		</span>
	);
}
