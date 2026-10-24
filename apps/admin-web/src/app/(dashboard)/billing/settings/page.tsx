import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { BillingSettings } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { BillingSettingsForm } from "./settings-form";

export const metadata = { title: "Coordonnées bancaires" };

export default async function BillingSettingsPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "billing:read")) notFound();
	const settings = await apiGet<BillingSettings>("/billing/settings");

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour à la facturation">
					<Link href="/billing">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="grid leading-tight">
					<h1 className="font-semibold">Coordonnées bancaires et facturation</h1>
					<span className="text-xs text-muted-foreground">
						Imprimées sur chaque facture et dans chaque e-mail de facturation.
					</span>
				</div>
			</div>
			<BillingSettingsForm settings={settings} readOnly={!can(session.user.permissions, "billing:write")} />
		</>
	);
}
