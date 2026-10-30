"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubscriptionDialog } from "./subscription-dialog";

/** Opens the subscription dialog from the dashboard card. */
export function SubscriptionButton({ quotePending, trialing }: { quotePending: boolean; trialing: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
				{quotePending ? "Voir mon devis" : trialing ? "Choisir mon offre" : "Gérer l’abonnement"}
			</Button>
			<SubscriptionDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
