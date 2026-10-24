import {
	ArrowLeft,
	Building2,
	CalendarDays,
	CreditCard,
	Database,
	ExternalLink,
	FileText,
	Gauge,
	Globe,
	Layers,
	Mail,
	MapPin,
	Pencil,
	Phone,
	Stethoscope,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatLimit, formatPrice, formatStorage } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { TenantBilling } from "@/lib/billing";
import type { TenantFeatures } from "@/lib/features";
import type { Plan } from "@/lib/plans";
import type { TenantDatabaseInfo } from "@/lib/tenant-databases";
import { SUBSCRIPTION_STATUS_LABELS, type Tenant, type TenantAuditPage } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";
import { TenantStatusBadge } from "../_components/tenant-status-badge";
import { ScheduledChangeBanner } from "./_components/scheduled-change-banner";
import { StatusActions } from "./_components/status-change-dialog";
import { TenantAuditLog } from "./_components/tenant-audit-log";
import { TenantTabs } from "./_components/tenant-tabs";
import { TenantFeaturesTab } from "./_components/tenant-features";
import { TenantSubscription } from "./_components/tenant-subscription";
import { TenantTechnical } from "./_components/tenant-technical";

export async function generateMetadata({ params }: PageProps<"/tenants/[id]">) {
	const tenant = await apiGet<Tenant>(`/tenants/${(await params).id}`);
	return { title: tenant.name };
}

/**
 * Module 2, Scenario B — one cabinet: an "at a glance" strip (plan,
 * subscription, invoices, database, features) linking to its tabs, then
 * Informations, Abonnement, Fonctionnalités, Technique and Audit. Utilisateurs,
 * Stockage and Activité need the clinic app's data.
 */
export default async function TenantPage({ params, searchParams }: PageProps<"/tenants/[id]">) {
	const { id } = await params;
	const auditPage = Math.max(1, Number((await searchParams).auditPage) || 1);
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:read")) notFound();
	const canWrite = can(session.user.permissions, "tenants:write");
	const canReadTechnical = can(session.user.permissions, "technical:read");
	const canReadPlans = can(session.user.permissions, "subscriptions:read");
	const [tenant, audit, database, billing, plans, features] = await Promise.all([
		apiGet<Tenant>(`/tenants/${id}`),
		apiGet<TenantAuditPage>(`/tenants/${id}/audit?page=${auditPage}&perPage=20`),
		canReadTechnical ? apiGet<TenantDatabaseInfo>(`/tenants/${id}/database`) : null,
		apiGet<TenantBilling>(`/tenants/${id}/billing`),
		canReadPlans ? apiGet<Plan[]>("/plans?active=true") : [],
		apiGet<TenantFeatures>(`/tenants/${id}/features`),
	]);

	const sub = billing.subscription;
	const openInvoices = billing.invoices.filter((i) => i.status === "billed" || i.status === "overdue");
	const overdue = openInvoices.filter((i) => i.status === "overdue");
	const activeFeatures = features.features.filter((f) => f.effective.enabled).length;
	const url = tenant.domain ? `${tenant.domain.subdomain}.cabinova.ma` : null;
	const initials = tenant.name
		.split(/\s+/)
		.filter((w) => /\p{L}/u.test(w[0] ?? ""))
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join("");
	const db = database?.database;

	/** One "at a glance" tile, linking to the tab that holds the details. */
	const tile = (
		icon: React.ElementType,
		label: string,
		value: React.ReactNode,
		hint: React.ReactNode,
		href: string,
		tone?: "warn" | "bad" | "good",
	) => {
		const Icon = icon;
		return (
			<Link
				href={href}
				scroll={false}
				className="grid gap-1 rounded-xl border bg-card p-3.5 transition-colors hover:bg-muted/40"
			>
				<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Icon className="size-3.5" />
					{label}
				</span>
				<span
					className={cn(
						"truncate text-base font-semibold",
						tone === "warn" && "text-amber-700",
						tone === "bad" && "text-red-700",
						tone === "good" && "text-emerald-700",
					)}
				>
					{value}
				</span>
				<span className="truncate text-xs text-muted-foreground">{hint}</span>
			</Link>
		);
	};

	/** A label / value line with an icon (Informations tab). */
	const line = (icon: React.ElementType, label: string, value: React.ReactNode) => {
		const Icon = icon;
		return (
			<div className="flex items-start gap-3 py-2.5 text-sm">
				<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<div className="grid min-w-0 gap-0.5">
					<span className="text-xs text-muted-foreground">{label}</span>
					<span className="break-words">{value ?? <span className="text-muted-foreground">—</span>}</span>
				</div>
			</div>
		);
	};

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux cabinets">
					<Link href="/tenants">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
					{initials || <Building2 className="size-5" />}
				</span>
				<div className="grid min-w-0 gap-0.5 leading-tight">
					<h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
						<span className="truncate">{tenant.name}</span>
						<TenantStatusBadge status={tenant.status} />
					</h1>
					<span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
						{url && (
							<a
								href={`https://${url}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 font-mono hover:text-foreground hover:underline"
							>
								<Globe className="size-3" />
								{url}
							</a>
						)}
						{tenant.city && (
							<span className="inline-flex items-center gap-1">
								<MapPin className="size-3" />
								{tenant.city}
							</span>
						)}
						<span className="inline-flex items-center gap-1">
							<CalendarDays className="size-3" />
							Créé le {formatDate(tenant.createdAt, { month: "short" })}
						</span>
					</span>
				</div>
				{canWrite && (
					<div className="ms-auto flex items-center gap-2">
						<StatusActions tenantId={tenant.id} transitions={tenant.availableTransitions} />
						{tenant.editable && (
							<Button asChild size="sm">
								<Link href={`/tenants/${tenant.id}/edit`}>
									<Pencil /> Modifier
								</Link>
							</Button>
						)}
					</div>
				)}
			</div>

			<section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5" aria-label="En un coup d’œil">
				{tile(
					CreditCard,
					"Offre",
					sub ? sub.plan.name : "Aucune",
					sub ? (sub.billingPeriod === "annual" ? "Facturation annuelle" : "Facturation mensuelle") : "À associer",
					"?tab=subscription",
					sub ? undefined : "warn",
				)}
				{tile(
					CalendarDays,
					"Abonnement",
					sub ? SUBSCRIPTION_STATUS_LABELS[sub.status] : "—",
					sub?.currentPeriodEnd
						? `${sub.status === "trialing" ? "Essai jusqu’au" : "Payé jusqu’au"} ${formatDate(sub.currentPeriodEnd, { month: "short" })}`
						: "—",
					"?tab=subscription",
					sub?.status === "past_due" ? "warn" : sub?.status === "active" ? "good" : undefined,
				)}
				{tile(
					FileText,
					"Factures",
					overdue.length
						? formatPrice(overdue.reduce((a, i) => a + i.amount, 0))
						: openInvoices.length
							? formatPrice(openInvoices.reduce((a, i) => a + i.amount, 0))
							: sub
								? formatPrice(sub.nextAmount)
								: "—",
					overdue.length
						? `${overdue.length} en retard`
						: openInvoices.length
							? "À encaisser"
							: sub
								? "Prochaine facture"
								: "Aucune facture",
					"?tab=subscription",
					overdue.length ? "bad" : openInvoices.length ? "warn" : undefined,
				)}
				{tile(
					Database,
					"Base de données",
					!database ? "—" : !db ? "Non créée" : db.healthy === false ? "Injoignable" : db.healthy ? "Joignable" : "Créée",
					!database
						? "Accès technique requis"
						: !db
							? tenant.status === "pending"
								? "À provisionner"
								: "—"
							: db.schemaVersion === database.latestSchemaVersion
								? `Schéma à jour${db.latencyMs ? ` · ${db.latencyMs} ms` : ""}`
								: "Schéma en retard",
					"?tab=technical",
					!database ? undefined : !db ? "warn" : db.healthy === false ? "bad" : db.healthy ? "good" : undefined,
				)}
				{tile(
					Layers,
					"Fonctionnalités",
					`${activeFeatures} / ${features.features.length}`,
					features.features.some((f) => f.override) ? "Avec exceptions" : "Selon l’offre",
					"?tab=features",
				)}
			</section>

			{tenant.scheduledStatusChange && (
				<ScheduledChangeBanner tenantId={tenant.id} change={tenant.scheduledStatusChange} canCancel={canWrite} />
			)}

			<TenantTabs
				subscription={
					<TenantSubscription
						tenantId={tenant.id}
						billing={billing}
						plans={plans}
						canManage={can(session.user.permissions, "subscriptions:write")}
						canBill={can(session.user.permissions, "billing:write")}
						closed={tenant.status === "closed"}
					/>
				}
				features={
					<TenantFeaturesTab
						tenantId={tenant.id}
						tenantName={tenant.name}
						data={features}
						canWrite={can(session.user.permissions, "subscriptions:write")}
					/>
				}
				technical={
					database && (
						<TenantTechnical
							tenantId={tenant.id}
							status={tenant.status}
							info={database}
							canWrite={can(session.user.permissions, "technical:write")}
						/>
					)
				}
				audit={
					<FormCard>
						<TenantAuditLog tenantId={tenant.id} audit={audit} page={auditPage} />
					</FormCard>
				}
				informations={
					<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
							<FormCard title="Identité">
								<div className="divide-y">
									{line(Building2, "Nom du cabinet", tenant.name)}
									{line(FileText, "Raison sociale", tenant.legalName)}
									{line(Stethoscope, "Spécialité", tenant.specialty)}
									{line(Gauge, "Identifiant technique", <code className="text-xs">{tenant.slug}</code>)}
								</div>
							</FormCard>
							<FormCard title="Contact">
								<div className="divide-y">
									{line(UserRound, "Médecin responsable", tenant.responsibleName)}
									{line(
										Mail,
										"E-mail",
										<a href={`mailto:${tenant.email}`} className="hover:underline">
											{tenant.email}
										</a>,
									)}
									{line(
										Phone,
										"Téléphone",
										tenant.phone && (
											<a href={`tel:${tenant.phone.replace(/\s+/g, "")}`} className="hover:underline">
												{tenant.phone}
											</a>
										),
									)}
									{line(MapPin, "Adresse", [tenant.address, tenant.city].filter(Boolean).join(", ") || null)}
								</div>
							</FormCard>
						</div>

						<div className="grid gap-3">
							<FormCard title="Adresse web">
								{url ? (
									<a
										href={`https://${url}`}
										target="_blank"
										rel="noreferrer"
										className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-sm hover:bg-muted"
									>
										<span className="truncate">{url}</span>
										<ExternalLink className="size-4 shrink-0 text-muted-foreground" />
									</a>
								) : (
									<p className="text-sm text-muted-foreground">Aucun sous-domaine.</p>
								)}
								<dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
									<div className="grid gap-0.5">
										<dt className="text-xs text-muted-foreground">Domaine personnalisé</dt>
										<dd>{tenant.domain?.customDomain ?? "—"}</dd>
									</div>
									<div className="grid gap-0.5">
										<dt className="text-xs text-muted-foreground">Certificat SSL</dt>
										<dd>
											{{ none: "Non requis", pending: "En cours", active: "Actif", error: "Erreur" }[
												tenant.domain?.sslStatus ?? "none"
											]}
										</dd>
									</div>
								</dl>
							</FormCard>

							<FormCard
								title="Quotas"
								action={
									tenant.editable &&
									canWrite && (
										<Button asChild size="sm" variant="ghost">
											<Link href={`/tenants/${tenant.id}/edit`}>Ajuster</Link>
										</Button>
									)
								}
							>
								<div className="grid grid-cols-2 gap-2">
									{[
										["Médecins", formatLimit(tenant.maxDoctors)],
										["Secrétaires", formatLimit(tenant.maxSecretaries)],
										["Utilisateurs", formatLimit(tenant.maxUsers)],
										["Stockage", formatStorage(tenant.storageQuotaMb)],
									].map(([label, value]) => (
										<div key={label} className="grid gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
											<span className="text-xs text-muted-foreground">{label}</span>
											<span className="font-semibold tabular-nums">{value}</span>
										</div>
									))}
								</div>
							</FormCard>
						</div>
					</div>
				}
			/>
		</>
	);
}
