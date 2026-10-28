import { LuArrowLeft } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import type { Plan } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { EMPTY_TENANT } from "@/lib/tenants";
import { CreateTenantForm } from "../_components/create-tenant-form";

export const metadata = { title: "Nouveau cabinet" };

export default async function NewTenantPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:write")) notFound();
	// Offers that can still be picked (archived ones are hidden).
	const plans = can(session.user.permissions, "subscriptions:read")
		? await apiGet<Plan[]>("/plans?active=true")
		: [];

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux cabinets">
					<Link href="/tenants">
						<LuArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Ajouter un cabinet</h1>
			</div>
			<CreateTenantForm defaultValues={EMPTY_TENANT} plans={plans} />
		</>
	);
}
