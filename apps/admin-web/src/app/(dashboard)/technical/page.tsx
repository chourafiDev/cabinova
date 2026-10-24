import Link from "next/link";
import { notFound } from "next/navigation";
import { HiServerStack } from "react-icons/hi2";
import { LuDatabase, LuDatabaseZap, LuGitPullRequestArrow, LuTriangleAlert } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { TenantDatabasesOverview } from "@/lib/tenant-databases";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { KpiCard } from "../_components/shared/kpi-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { TenantStatusBadge } from "../tenants/_components/tenant-status-badge";
import { MigrateBehindButton } from "./_components/migrate-behind-button";

export const metadata = { title: "Technique" };

/**
 * Module 4 — every clinic database at a glance: schema version against the
 * latest, connection health, failed migrations. Problems sort first.
 */
export default async function TechnicalPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "technical:read")) notFound();
	const overview = await apiGet<TenantDatabasesOverview>("/tenant-databases");

	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2 align-top";

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiServerStack />}
				total={overview.total}
				label={{ singular: "Base de cabinet", plural: "Bases de cabinets" }}
				action={
					can(session.user.permissions, "technical:write") ? (
						<MigrateBehindButton behind={overview.behind} />
					) : undefined
				}
			/>

			<div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={LuDatabase}
					title="Schéma courant"
					value={<code className="text-base">{overview.latestSchemaVersion ?? "—"}</code>}
					period="@cabinova/tenant-db"
					hint="Dernière migration du schéma des bases de cabinets."
				/>
				<KpiCard
					icon={LuGitPullRequestArrow}
					title="En retard de migration"
					value={overview.behind}
					valueClassName={overview.behind ? "text-amber-700" : undefined}
					period="Maintenant"
					hint="Bases dont la version du schéma n'est pas la dernière."
				/>
				<KpiCard
					icon={LuDatabaseZap}
					title="Injoignables"
					value={overview.unhealthy}
					valueClassName={overview.unhealthy ? "text-red-700" : undefined}
					period="Dernier test"
					hint="Bases dont le dernier test de connexion a échoué (test automatique toutes les 10 minutes)."
				/>
				<KpiCard
					icon={LuTriangleAlert}
					title="Migrations échouées"
					value={overview.failedMigrations}
					valueClassName={overview.failedMigrations ? "text-red-700" : undefined}
					period="Maintenant"
					hint="Bases isolées après une migration en échec : elles sont ignorées jusqu'à correction."
				/>
			</div>

			<FormCard contentClassName="p-0 overflow-x-auto">
				{overview.data.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						Aucune base : provisionnez un cabinet depuis son onglet Technique.
					</p>
				) : (
					<table className="w-full min-w-[720px] text-sm">
						<thead>
							<tr className="border-b">
								<th className={th}>Cabinet</th>
								<th className={th}>Base</th>
								<th className={th}>Schéma</th>
								<th className={th}>Connexion</th>
								<th className={th}>Dernier test</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{overview.data.map((db) => {
								const behind = db.schemaVersion !== overview.latestSchemaVersion;
								return (
									<tr key={db.tenantId}>
										<td className={td}>
											<Link
												href={`/tenants/${db.tenantId}?tab=technical`}
												className="flex flex-wrap items-center gap-2 font-medium hover:underline"
											>
												{db.tenantName}
												<TenantStatusBadge status={db.tenantStatus} />
											</Link>
										</td>
										<td className={td}>
											<code className="text-xs">{db.databaseName}</code>
										</td>
										<td className={td}>
											<span className="flex flex-wrap items-center gap-1.5">
												<code className="text-xs">{db.schemaVersion ?? "aucun"}</code>
												{behind && (
													<Badge variant="outline" className="border-transparent bg-amber-50 text-amber-700">
														En retard
													</Badge>
												)}
											</span>
											{db.lastMigrationError && (
												<p className="mt-1 max-w-72 text-xs text-destructive">{db.lastMigrationError}</p>
											)}
										</td>
										<td className={td}>
											{db.healthy === null ? (
												<span className="text-muted-foreground">Jamais testée</span>
											) : (
												<Badge
													variant="outline"
													className={cn(
														"border-transparent",
														db.healthy ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
													)}
												>
													{db.healthy ? `Joignable · ${db.latencyMs} ms` : "Injoignable"}
												</Badge>
											)}
											{db.lastHealthError && (
												<p className="mt-1 max-w-72 text-xs text-destructive">{db.lastHealthError}</p>
											)}
										</td>
										<td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
											{db.lastHealthCheckAt
												? formatDate(db.lastHealthCheckAt, { month: "short", hour: "2-digit", minute: "2-digit" })
												: "—"}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</FormCard>
		</ListTransitionProvider>
	);
}
