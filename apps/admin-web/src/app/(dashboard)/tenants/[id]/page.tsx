import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { Tenant } from "@/lib/tenants";
import { FormCard } from "../../_components/shared/form-card";
import { TenantStatusBadge } from "../_components/tenant-status-badge";

export async function generateMetadata({ params }: PageProps<"/tenants/[id]">) {
	const tenant = await apiGet<Tenant>(`/tenants/${(await params).id}`);
	return { title: tenant.name };
}

/**
 * Informations tab only (per the doc's tabbed layout). The other tabs —
 * Abonnement, Utilisateurs, Domaine (SSL), Stockage, Activité, Facturation,
 * Technique, Audit — ship with the module that owns their data.
 */
export default async function TenantPage({ params }: PageProps<"/tenants/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:read")) notFound();
	const tenant = await apiGet<Tenant>(`/tenants/${id}`);

	const row = (label: string, value: React.ReactNode) => (
		<div className="grid grid-cols-[160px_1fr] gap-4 py-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd>{value ?? <span className="text-muted-foreground">—</span>}</dd>
		</div>
	);

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux cabinets">
					<Link href="/tenants">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="grid min-w-0 leading-tight">
					<h1 className="flex items-center gap-2 truncate font-semibold">
						{tenant.name}
						<TenantStatusBadge status={tenant.status} />
					</h1>
					<span className="text-muted-foreground text-xs">
						Créé le {formatDate(tenant.createdAt, { month: "short" })}
					</span>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
				<FormCard title="Informations">
					<dl className="divide-y">
						{row("Nom du cabinet", tenant.name)}
						{row("Raison sociale", tenant.legalName)}
						{row("Médecin responsable", tenant.responsibleName)}
						{row("Spécialité", tenant.specialty)}
						{row("E-mail", tenant.email)}
						{row("Téléphone", tenant.phone)}
						{row("Adresse", tenant.address)}
						{row("Ville", tenant.city)}
						{row("Identifiant technique", <code className="text-xs">{tenant.slug}</code>)}
					</dl>
				</FormCard>

				<div className="grid gap-3">
					<FormCard title="Domaine">
						<dl className="divide-y">
							{row("Sous-domaine", tenant.domain ? `${tenant.domain.subdomain}.cabinova.ma` : null)}
							{row("Domaine personnalisé", tenant.domain?.customDomain)}
							{row("SSL", tenant.domain?.sslStatus)}
						</dl>
					</FormCard>

					<FormCard title="Essai et limites">
						<dl className="divide-y">
							{row("Début d'essai", tenant.trialStartsAt && formatDate(tenant.trialStartsAt))}
							{row("Fin d'essai", tenant.trialEndsAt && formatDate(tenant.trialEndsAt))}
							{row("Médecins max.", tenant.maxDoctors ?? "Illimité")}
							{row("Utilisateurs max.", tenant.maxUsers ?? "Illimité")}
						</dl>
					</FormCard>
				</div>
			</div>
		</>
	);
}
