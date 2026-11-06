"use client";

import { useTranslations } from "next-intl";
import { IconHourglass } from "@/components/icons";

/** A part of the dossier not built yet: what it will hold. */
export function Planned({ fields }: { fields: string[] }) {
	const t = useTranslations("dossier.planned");
	return (
		<div className="bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
			<span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
				<IconHourglass className="size-4" />
			</span>
			<p className="text-sm font-medium">{t("title")}</p>
			{fields.length > 0 && <p className="text-muted-foreground max-w-md text-xs">{fields.join(" · ")}</p>}
		</div>
	);
}
