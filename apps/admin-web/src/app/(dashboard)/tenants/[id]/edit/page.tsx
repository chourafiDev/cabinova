import { LuArrowLeft } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { type Tenant, toUpdateTenantInput } from "@/lib/tenants";
import { TenantForm } from "../../_components/tenant-form";

export const metadata = { title: "Modifier le cabinet" };

/** Module 2, Scenario B — every saved change lands in the cabinet's Audit tab. */
export default async function EditTenantPage({ params }: PageProps<"/tenants/[id]/edit">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:write")) notFound();
	const tenant = await apiGet<Tenant>(`/tenants/${id}`);
	if (!tenant.editable) notFound();

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour au cabinet">
					<Link href={`/tenants/${id}`}>
						<LuArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Modifier {tenant.name}</h1>
			</div>
			<TenantForm tenantId={id} defaultValues={toUpdateTenantInput(tenant)} />
		</>
	);
}
