"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubscriptionDialog } from "./subscription-dialog";

/** Opens the subscription dialog from the dashboard card. */
export function SubscriptionButton({ quotePending, trialing }: { quotePending: boolean; trialing: boolean }) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("billing.banner");
	return (
		<>
			<Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
				{quotePending ? t("seeQuote") : trialing ? t("chooseOffer") : t("manage")}
			</Button>
			<SubscriptionDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
