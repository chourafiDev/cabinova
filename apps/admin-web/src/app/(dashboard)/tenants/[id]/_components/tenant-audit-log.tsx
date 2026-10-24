import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { BILLING_PERIOD_LABELS, type BillingPeriod, formatStorage } from "@/lib/plans";
import {
	reasonLabel,
	STATUS_LABELS,
	type TenantAuditEntry,
	type TenantAuditPage,
	type TenantStatus,
} from "@/lib/tenants";

const FIELD_LABELS: Record<string, string> = {
	name: "Nom du cabinet",
	legalName: "Raison sociale",
	responsibleName: "Médecin responsable",
	specialty: "Spécialité",
	address: "Adresse",
	city: "Ville",
	phone: "Téléphone",
	email: "E-mail",
	maxDoctors: "Médecins max.",
	maxSecretaries: "Secrétaires max.",
	maxUsers: "Utilisateurs max.",
	storageQuotaMb: "Stockage",
};

const QUOTAS = new Set(["maxDoctors", "maxSecretaries", "maxUsers", "storageQuotaMb"]);

const show = (field: string, value: unknown) => {
	if (value === null || value === undefined || value === "") return QUOTAS.has(field) ? "Illimité" : "—";
	return field === "storageQuotaMb" ? formatStorage(Number(value)) : String(value);
};

const status = (value: unknown) => STATUS_LABELS[value as TenantStatus] ?? String(value);

/** One line of the timeline: what happened, then its details. */
function describe(entry: TenantAuditEntry): { title: string; details?: React.ReactNode } {
	const m = (entry.metadata ?? {}) as Record<string, unknown>;
	const motive = (
		<>
			{m.reason ? <p>Motif : {reasonLabel(String(m.transition), m.reason as string)}</p> : null}
			{m.comment ? <p className="whitespace-pre-line text-muted-foreground">« {String(m.comment)} »</p> : null}
		</>
	);
	switch (entry.action) {
		case "tenant.create":
			return {
				title: "Cabinet créé",
				details: (
					<>
						{m.subdomain ? <p>Sous-domaine : {String(m.subdomain)}</p> : null}
						{m.plan ? (
							<p>
								Offre : {String(m.plan)}
								{m.billingPeriod ? ` (${BILLING_PERIOD_LABELS[m.billingPeriod as BillingPeriod]})` : ""}
								{typeof m.trialDays === "number" ? `, essai de ${m.trialDays} jours` : ""}
							</p>
						) : null}
					</>
				),
			};
		case "tenant.update": {
			const changes = (m.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
			return {
				title: "Informations modifiées",
				details: (
					<ul className="grid gap-0.5">
						{Object.entries(changes).map(([field, { from, to }]) => (
							<li key={field} className="flex flex-wrap items-center gap-1.5">
								<span className="text-muted-foreground">{FIELD_LABELS[field] ?? field} :</span>
								<span className="line-through decoration-muted-foreground/60">{show(field, from)}</span>
								<ArrowRight className="size-3 text-muted-foreground" />
								<span>{show(field, to)}</span>
							</li>
						))}
					</ul>
				),
			};
		}
		case "tenant.status.apply":
			return {
				title: `Statut : ${status(m.from)} → ${status(m.to)}${m.system ? " (automatique)" : m.automatic ? " (programmé)" : ""}`,
				details: motive,
			};
		case "tenant.status.schedule":
			return {
				title: `Changement programmé : ${status(m.from)} → ${status(m.to)} le ${formatDate(m.effectiveAt as string)}`,
				details: motive,
			};
		case "tenant.status.cancel":
			return { title: `Changement programmé annulé (${status(m.from)} → ${status(m.to)})` };
		case "tenant.status.failed":
			return {
				title: `Changement programmé non appliqué (${status(m.from)} → ${status(m.to)})`,
				details: m.failureReason ? <p className="text-destructive">{String(m.failureReason)}</p> : null,
			};
		case "tenant.provision.start":
			return { title: "Provisionnement lancé" };
		case "tenant.provision.succeed":
			return { title: "Provisionnement terminé" };
		case "tenant.provision.fail":
			return {
				title: `Provisionnement échoué${m.step ? ` (${String(m.step)})` : ""}`,
				details: m.error ? <p className="text-destructive">{String(m.error)}</p> : null,
			};
		case "tenant.database.migrate":
			return { title: `Schéma migré : ${String(m.from ?? "aucun")} → ${String(m.to)}` };
		case "tenant.database.migrate_failed":
			return {
				title: "Migration échouée",
				details: m.error ? <p className="text-destructive">{String(m.error)}</p> : null,
			};
		case "tenant.database.unreachable":
			return {
				title: "Base injoignable",
				details: m.error ? <p className="text-destructive">{String(m.error)}</p> : null,
			};
		case "tenant.database.recovered":
			return { title: "Base de nouveau joignable" };
		default:
			return { title: entry.action };
	}
}

/** Module 2, Scenario B — the cabinet's administrative changes, newest first. */
export function TenantAuditLog({
	tenantId,
	audit,
	page,
}: {
	tenantId: string;
	audit: TenantAuditPage;
	page: number;
}) {
	if (!audit.data.length) {
		return <p className="py-6 text-center text-sm text-muted-foreground">Aucun événement enregistré.</p>;
	}
	const href = (p: number) => `/tenants/${tenantId}?tab=audit&auditPage=${p}`;

	return (
		<div className="grid gap-3">
			<ol className="divide-y">
				{audit.data.map((entry) => {
					const { title, details } = describe(entry);
					return (
						<li key={entry.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[180px_1fr] sm:gap-4">
							<div className="text-xs text-muted-foreground">
								<time dateTime={entry.createdAt}>
									{formatDate(entry.createdAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
								</time>
								<div>{entry.actor?.name ?? "Système"}</div>
							</div>
							<div className="grid gap-1">
								<p className="font-medium">{title}</p>
								{details && <div className="grid gap-0.5 text-xs">{details}</div>}
							</div>
						</li>
					);
				})}
			</ol>
			{audit.pageCount > 1 && (
				<div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
					<span>
						Page {page} / {audit.pageCount}
					</span>
					<Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
						{page > 1 ? <Link href={href(page - 1)}>Précédent</Link> : <span>Précédent</span>}
					</Button>
					<Button asChild={page < audit.pageCount} variant="outline" size="sm" disabled={page >= audit.pageCount}>
						{page < audit.pageCount ? <Link href={href(page + 1)}>Suivant</Link> : <span>Suivant</span>}
					</Button>
				</div>
			)}
		</div>
	);
}
