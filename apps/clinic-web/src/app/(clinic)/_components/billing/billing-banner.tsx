"use client";

import { LuSparkles, LuTriangleAlert } from "react-icons/lu";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingNotice } from "@/lib/billing-notice";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SubscriptionDialog } from "./subscription-dialog";

const TONES: Record<BillingNotice["tone"], string> = {
	info: "bg-brand/10 text-foreground",
	warning: "bg-amber-50 text-amber-900",
	danger: "bg-red-50 text-red-900",
};

function message(notice: BillingNotice) {
	switch (notice.kind) {
		case "trial":
			return (
				<>
					<strong className="font-semibold">Essai gratuit : {notice.daysLeft} jours restants</strong>
					<span className="text-muted-foreground hidden sm:inline">
						{" "}
						· jusqu’au {formatDate(notice.endsAt, { year: undefined })}
					</span>
				</>
			);
		case "trial-last-day":
			return <strong className="font-semibold">Dernier jour de votre essai gratuit.</strong>;
		case "trial-ended":
			return (
				<>
					<strong className="font-semibold">Votre essai est terminé.</strong>{" "}
					<span className="hidden sm:inline">La première facture arrive par e-mail.</span>
				</>
			);
		case "past-due":
			return (
				<>
					<strong className="font-semibold">Facture en attente de paiement.</strong>{" "}
					<span className="hidden sm:inline">Réglez-la par virement pour garder l’accès à votre cabinet.</span>
				</>
			);
	}
}

/**
 * Subscription banner under the header, for the responsible doctor: trial
 * countdown or unpaid invoice, with the offer and payment details one click
 * away. It can't be closed: it stays up for the whole trial.
 */
export function BillingBanner({ notice }: { notice: BillingNotice }) {
	const [open, setOpen] = useState(false);
	const Icon = notice.tone === "info" ? LuSparkles : LuTriangleAlert;

	return (
		<div
			role={notice.tone === "danger" ? "alert" : "status"}
			className={cn("flex items-center gap-3 border-b px-4 py-2 text-sm", TONES[notice.tone])}
		>
			<Icon className={cn("size-4 shrink-0", notice.tone === "info" && "text-primary")} />
			<p className="min-w-0 flex-1 truncate">{message(notice)}</p>
			<Button
				size="sm"
				variant={notice.tone === "danger" ? "destructive" : "default"}
				className="h-7 shrink-0"
				onClick={() => setOpen(true)}
			>
				{notice.kind === "past-due" ? "Voir comment payer" : "Choisir mon offre"}
			</Button>
			<SubscriptionDialog open={open} onOpenChange={setOpen} />
		</div>
	);
}
