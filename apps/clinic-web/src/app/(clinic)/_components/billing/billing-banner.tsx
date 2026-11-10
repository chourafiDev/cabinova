"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconSparkles, IconWarning } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { BillingNotice } from "@/lib/billing-notice";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SubscriptionDialog } from "./subscription-dialog";

const TONES: Record<BillingNotice["tone"], string> = {
	info: "bg-brand/10 text-foreground",
	warning: "bg-amber-50 text-amber-900",
	danger: "bg-red-50 text-red-900",
};

function Message({ notice }: { notice: BillingNotice }) {
	const t = useTranslations("billing.banner");
	const format = useFormat();
	const short = (date: string) => format.date(date, { year: undefined });
	const strong = (text: string) => (
		<strong className="font-semibold">{text}</strong>
	);
	const hint = (text: string) => (
		<span className="hidden sm:inline">{text}</span>
	);
	switch (notice.kind) {
		case "trial":
			return (
				<>
					{strong(t("trial", { days: notice.daysLeft }))}
					<span className="text-muted-foreground hidden sm:inline">
						{" "}
						{t("trialUntil", { date: short(notice.endsAt) })}
					</span>
				</>
			);
		case "trial-last-day":
			return strong(t("lastDay"));
		case "trial-ended":
			return (
				<>
					{strong(t("ended"))} {hint(t("endedHint"))}
				</>
			);
		case "quote-due":
			return (
				<>
					{strong(t("quoteDue"))} {hint(t("quoteDueHint"))}
				</>
			);
		case "renewal-due":
			return strong(t("renewal", { date: short(notice.dueAt) }));
		case "past-due":
			return (
				<>
					{strong(t("pastDue"))} {hint(t("pastDueHint"))}
				</>
			);
	}
}

/**
 * Subscription banner under the header, for the responsible doctor: trial
 * countdown, renewal or unpaid invoice, with the offer and payment details one click
 * away. It can't be closed: it stays up for the whole trial.
 */
export function BillingBanner({ notice }: { notice: BillingNotice }) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("billing.banner");
	const Icon = notice.tone === "info" ? IconSparkles : IconWarning;

	return (
		<div
			role={notice.tone === "danger" ? "alert" : "status"}
			className={cn(
				"flex items-center gap-3 px-4 py-2 text-sm mx-4 mt-2 rounded-xl",
				TONES[notice.tone],
			)}
		>
			<Icon
				className={cn(
					"size-4 shrink-0",
					notice.tone === "info" && "text-primary",
				)}
			/>
			<p className="min-w-0 flex-1 truncate">
				<Message notice={notice} />
			</p>
			<Button
				size="sm"
				variant={notice.tone === "danger" ? "destructive" : "default"}
				className="h-7 shrink-0"
				onClick={() => setOpen(true)}
			>
				{notice.kind === "past-due" || notice.kind === "renewal-due"
					? t("howToPay")
					: notice.kind === "quote-due" ||
							("quotePending" in notice && notice.quotePending)
						? t("seeQuote")
						: t("chooseOffer")}
			</Button>
			<SubscriptionDialog open={open} onOpenChange={setOpen} />
		</div>
	);
}
