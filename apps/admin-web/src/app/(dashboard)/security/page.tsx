import Link from "next/link";
import { notFound } from "next/navigation";
import { HiShieldCheck } from "react-icons/hi2";
import { LuChevronLeft, LuChevronRight, LuKeyRound, LuShieldAlert, LuUserX } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
	ACTION_LABELS,
	AUDIT_CATEGORY_LABELS,
	AUDIT_PERIODS,
	type AuditEntry,
	type AuditPage,
	type SecuritySummary,
} from "@/lib/security";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { KpiCard } from "../_components/shared/kpi-card";
import { JournalFilters } from "./_components/journal-filters";
import { RetentionCard } from "./_components/retention-card";

export const metadata = { title: "Sécurité" };

const PER_PAGE = 50;

/** First day of the period, as YYYY-MM-DD. */
const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** A short, readable summary of an entry's details (no raw JSON in the table). */
function details(entry: AuditEntry) {
	const m = entry.metadata ?? {};
	const parts: string[] = [];
	const str = (k: string) => (typeof m[k] === "string" || typeof m[k] === "number" ? String(m[k]) : null);
	if (str("email")) parts.push(str("email")!);
	if (str("invoice")) parts.push(`facture ${str("invoice")}`);
	if (str("feature")) parts.push(str("feature")!);
	if (str("from") && str("to")) parts.push(`${str("from")} → ${str("to")}`);
	if (str("reason")) parts.push(`motif : ${str("reason")}`);
	if (str("sha256")) parts.push(`empreinte ${str("sha256")!.slice(0, 12)}…`);
	if (str("exportSha256")) parts.push(`preuve d’export ${str("exportSha256")!.slice(0, 12)}…`);
	if (str("method") && entry.action === "auth.login") parts.push(`via ${{ password: "mot de passe", totp: "mot de passe + 2FA", recovery: "code de secours" }[str("method")!] ?? str("method")}`);
	if (m.changes && typeof m.changes === "object") parts.push(`champs : ${Object.keys(m.changes).join(", ")}`);
	return parts.join(" · ");
}

/**
 * Sécurité et conformité: a security summary (failed sign-ins, 2FA
 * coverage, sensitive events), the data retention rule, and the full audit
 * journal — filterable and exportable.
 */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "security:read")) notFound();
	const params = await searchParams;
	const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
	const page = Math.max(1, Number(get("page")) || 1);
	const periodKey = get("period") ?? "30d";
	const days = AUDIT_PERIODS[periodKey]?.days;
	const query = new URLSearchParams({
		...(days && { from: since(days) }),
		...(get("category") && { category: get("category")! }),
		...(get("actor") && { actorId: get("actor")! }),
		...(get("sensitive") === "true" && { sensitive: "true" }),
		...(get("search") && { search: get("search")! }),
	});
	const [summary, journal, compliance] = await Promise.all([
		apiGet<SecuritySummary>("/security/summary"),
		apiGet<AuditPage>(`/security/audit?${query}&page=${page}&perPage=${PER_PAGE}`),
		apiGet<{ retentionYears: number }>("/security/compliance"),
	]);
	const pageHref = (p: number) => {
		const next = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
		next.set("page", String(p));
		return `/security?${next}`;
	};
	const coverageOk = summary.usersWithTwoFactor === summary.activeUsers;

	return (
		<>
			<div className="mb-4 flex items-center gap-2 border-b border-dashed border-foreground/20 pb-4">
				<span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
					<HiShieldCheck className="size-4" />
				</span>
				<div className="grid leading-tight">
					<h1 className="font-semibold">Sécurité et conformité</h1>
					<span className="text-xs text-muted-foreground">Journal d’audit, connexions, double authentification, conservation des données.</span>
				</div>
			</div>

			<section className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
				<KpiCard
					icon={LuUserX}
					title="Échecs de connexion"
					value={summary.failedLogins24h + summary.failedTwoFactor24h}
					valueClassName={summary.failedLogins24h + summary.failedTwoFactor24h >= 10 ? "text-destructive" : undefined}
					period={`24 h · dont ${summary.failedTwoFactor24h} code(s) 2FA`}
					hint="Mots de passe et codes de double authentification incorrects, toutes adresses confondues."
				/>
				<KpiCard
					icon={LuKeyRound}
					title="Comptes en 2FA"
					value={`${summary.usersWithTwoFactor} / ${summary.activeUsers}`}
					valueClassName={coverageOk ? "text-emerald-700" : "text-amber-700"}
					period="Comptes protégés"
					hint="Comptes actifs ayant activé la double authentification."
				/>
				<KpiCard
					icon={LuShieldAlert}
					title="Actions sensibles"
					value={summary.sensitiveEvents7d}
					period="7 derniers jours"
					hint="Accès, permissions, statuts de cabinets, données, paiements, coordonnées bancaires."
				/>
			</section>

			<div className="mb-3 grid gap-3 lg:grid-cols-2">
				<FormCard title="Comptes sans double authentification">
					{summary.usersWithoutTwoFactor.length === 0 ? (
						<p className="text-sm text-emerald-700">Tous les comptes actifs sont protégés.</p>
					) : (
						<div className="grid gap-2 text-sm">
							<ul className="flex flex-wrap gap-2">
								{summary.usersWithoutTwoFactor.map((u) => (
									<li key={u.id}>
										<Link href={u.id === session.user.id ? "/account/security" : `/users/${u.id}`} className="rounded-full border px-2.5 py-0.5 hover:bg-muted">
											{u.name}
											{u.id === session.user.id && " (vous)"}
										</Link>
									</li>
								))}
							</ul>
							<p className="text-xs text-muted-foreground">
								Chacun l’active depuis son menu → Sécurité du compte.
							</p>
						</div>
					)}
				</FormCard>
				<RetentionCard years={compliance.retentionYears} canEdit={can(session.user.permissions, "settings:write")} />
			</div>

			<FormCard title={`Journal d’audit · ${journal.total} événement${journal.total > 1 ? "s" : ""}`} contentClassName="p-0">
				<div className="border-b p-3">
					<JournalFilters summary={summary} exportHref={`/api/security/audit/export.csv?${query}`} />
				</div>
				{journal.data.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">Aucun événement pour ces filtres.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[820px] text-sm">
							<thead>
								<tr className="border-b text-start text-xs text-muted-foreground">
									<th className="px-3 py-2 text-start font-normal">Date</th>
									<th className="px-3 py-2 text-start font-normal">Événement</th>
									<th className="px-3 py-2 text-start font-normal">Auteur</th>
									<th className="px-3 py-2 text-start font-normal">Cabinet</th>
									<th className="px-3 py-2 text-start font-normal">Détails</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{journal.data.map((e) => (
									<tr key={e.id} className={cn(e.sensitive && "bg-amber-50/40")}>
										<td className="whitespace-nowrap px-3 py-2 align-top text-xs text-muted-foreground tabular-nums">
											{formatDate(e.createdAt, { month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
										</td>
										<td className="px-3 py-2 align-top">
											<span className="flex flex-wrap items-center gap-1.5">
												{e.sensitive && <LuShieldAlert className="size-3.5 text-amber-600" aria-label="Sensible" />}
												<span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
												{e.category && (
													<Badge variant="outline" className="border-transparent bg-muted text-[10px] font-normal">
														{AUDIT_CATEGORY_LABELS[e.category]}
													</Badge>
												)}
											</span>
										</td>
										<td className="px-3 py-2 align-top">
											<span className="grid leading-tight">
												<span>{e.actor?.name ?? <span className="text-muted-foreground">Système / inconnu</span>}</span>
												{e.ip && <span className="font-mono text-[11px] text-muted-foreground">{e.ip}</span>}
											</span>
										</td>
										<td className="px-3 py-2 align-top">
											{e.tenant ? (
												<Link href={`/tenants/${e.tenant.id}?tab=audit`} className="hover:underline">
													{e.tenant.name}
												</Link>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</td>
										<td className="max-w-80 px-3 py-2 align-top text-xs text-muted-foreground">{details(e) || "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{journal.pageCount > 1 && (
					<div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
						<span>
							Page {page} / {journal.pageCount}
						</span>
						<Button asChild={page > 1} size="icon-sm" variant="outline" disabled={page <= 1} aria-label="Page précédente">
							{page > 1 ? (
								<Link href={pageHref(page - 1)} scroll={false}>
									<LuChevronLeft />
								</Link>
							) : (
								<span>
									<LuChevronLeft />
								</span>
							)}
						</Button>
						<Button asChild={page < journal.pageCount} size="icon-sm" variant="outline" disabled={page >= journal.pageCount} aria-label="Page suivante">
							{page < journal.pageCount ? (
								<Link href={pageHref(page + 1)} scroll={false}>
									<LuChevronRight />
								</Link>
							) : (
								<span>
									<LuChevronRight />
								</span>
							)}
						</Button>
					</div>
				)}
			</FormCard>
		</>
	);
}
