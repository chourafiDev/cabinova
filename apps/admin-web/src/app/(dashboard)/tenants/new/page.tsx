import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { EMPTY_TENANT } from "@/lib/tenants";
import { TenantForm } from "../_components/tenant-form";

export const metadata = { title: "Nouveau cabinet" };

export default async function NewTenantPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:write")) notFound();

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux cabinets">
					<Link href="/tenants">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Ajouter un cabinet</h1>
			</div>
			<TenantForm defaultValues={EMPTY_TENANT} />
		</>
	);
}
