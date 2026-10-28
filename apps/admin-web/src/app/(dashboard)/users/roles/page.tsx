import { LuArrowLeft, LuCheck, LuLock, LuPencil } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { groupPermissions, type PermissionInfo, type PlatformRole } from "@/lib/platform-users";
import { plural } from "@/lib/plural";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { FormCard } from "../../_components/shared/form-card";
import { RoleDialog } from "./role-dialog";

export const metadata = { title: "Rôles et permissions" };

/**
 * Module 5 — the three central roles (Super Admin, Agent de Support, Agent
 * technique) and what each can do. The roles are fixed; the agents'
 * permissions can be adjusted.
 */
export default async function RolesPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "users:read")) notFound();
	const canWrite = can(session.user.permissions, "users:write");
	const [roles, catalog] = await Promise.all([
		apiGet<PlatformRole[]>("/platform-roles"),
		apiGet<PermissionInfo[]>("/platform-permissions"),
	]);
	const mine = session.user.permissions;

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux utilisateurs">
					<Link href="/users">
						<LuArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold">Rôles et permissions</h1>
			</div>

			<FormCard contentClassName="p-0 overflow-x-auto">
				<table className="w-full min-w-[560px] text-sm">
					<thead>
						<tr className="border-b">
							<th className="w-72 px-3 py-2" />
							{roles.map((role) => (
								<th key={role.id} className="px-2 py-3 text-center align-top font-normal">
									{/* Name, lock and edit icon on one line so every column lines up. */}
									<div className="flex h-7 items-center justify-center gap-1">
										{role.locked && <LuLock className="size-3 text-muted-foreground" aria-label="Verrouillé" />}
										<span className="font-semibold">{role.name}</span>
										{canWrite && !role.locked && (
											<RoleDialog role={role} catalog={catalog} myPermissions={mine}>
												<Button variant="ghost" size="icon-xs" aria-label={`Modifier ${role.name}`}>
													<LuPencil />
												</Button>
											</RoleDialog>
										)}
									</div>
									<span className="text-xs text-muted-foreground">{plural(role.userCount, "utilisateur")}</span>
								</th>
							))}
						</tr>
					</thead>
					{groupPermissions(catalog).map((group) => (
						<tbody key={group.resource} className="border-b last:border-0">
							<tr>
								<th
									colSpan={roles.length + 1}
									className="bg-muted/40 px-3 py-1.5 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground"
								>
									{group.label}
								</th>
							</tr>
							{group.permissions.map((p) => (
								<tr key={p.key}>
									<td className="px-3 py-1.5">
										{p.description}
										<code className="ms-1.5 text-[11px] text-muted-foreground">{p.key}</code>
									</td>
									{roles.map((role) => (
										<td key={role.id} className="px-2 py-1.5 text-center">
											{role.permissions.includes(p.key) ? (
												<LuCheck className="mx-auto size-4 text-emerald-600" aria-label="Oui" />
											) : (
												<span className="text-muted-foreground/40" aria-label="Non">
													·
												</span>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					))}
				</table>
			</FormCard>
			<p className="mt-3 text-xs text-muted-foreground">
				Trois rôles : Super Admin (toutes les permissions, non modifiable), Agent de Support et Agent technique
				(permissions ajustables). Un utilisateur peut recevoir des exceptions individuelles depuis sa fiche. Personne
				ne peut attribuer une permission qu’il n’a pas lui-même.
			</p>
		</>
	);
}
