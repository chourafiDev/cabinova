import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiUserGroup } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
	type PlatformRole,
	type PlatformUserRow,
	type PlatformUserStatus,
	USER_STATUS_LABELS,
} from "@/lib/platform-users";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { InviteUserDialog } from "./_components/invite-user-dialog";
import { UserStatusBadge } from "./_components/user-status-badge";

export const metadata = { title: "Utilisateurs" };

const FILTERS: (PlatformUserStatus | "all")[] = ["all", "active", "invited", "disabled"];

/** Module 5 — central users (not clinic staff, who live in each clinic's database). */
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "users:read")) notFound();
	const { status: rawStatus, search: rawSearch } = await searchParams;
	const status = FILTERS.includes(rawStatus as PlatformUserStatus) ? (rawStatus as PlatformUserStatus) : "all";
	const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
	const query = new URLSearchParams({
		...(status !== "all" && { status }),
		...(search && { search }),
	});
	const canWrite = can(session.user.permissions, "users:write");
	const [users, roles] = await Promise.all([
		apiGet<PlatformUserRow[]>(`/platform-users?${query}`),
		canWrite ? apiGet<PlatformRole[]>("/platform-roles") : [],
	]);
	const href = (s: string) => `/users?${new URLSearchParams({ ...(s !== "all" && { status: s }), ...(search && { search }) })}`;

	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiUserGroup />}
				total={users.length}
				label={{ singular: "Utilisateur", plural: "Utilisateurs" }}
				action={
					<div className="flex w-full gap-2 md:w-auto">
						<Button asChild variant="outline">
							<Link href="/users/roles">
								<ShieldCheck /> Rôles et permissions
							</Link>
						</Button>
						{canWrite && (
							<InviteUserDialog roles={roles} myPermissions={session.user.permissions}>
								<Button>Inviter un utilisateur</Button>
							</InviteUserDialog>
						)}
					</div>
				}
			/>

			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<nav className="flex gap-1 rounded-lg bg-muted p-[3px] text-sm" aria-label="Filtrer par statut">
					{FILTERS.map((s) => (
						<Link
							key={s}
							href={href(s)}
							aria-current={s === status ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 text-muted-foreground",
								s === status && "bg-background text-foreground shadow-sm",
							)}
						>
							{s === "all" ? "Tous" : USER_STATUS_LABELS[s]}
						</Link>
					))}
				</nav>
				<form action="/users" className="w-full sm:w-64">
					{status !== "all" && <input type="hidden" name="status" value={status} />}
					<Input name="search" defaultValue={search} placeholder="Nom ou e-mail…" aria-label="Rechercher" />
				</form>
			</div>

			<FormCard contentClassName="p-0 overflow-x-auto">
				{users.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">Aucun utilisateur.</p>
				) : (
					<table className="w-full min-w-[640px] text-sm">
						<thead>
							<tr className="border-b">
								<th className={th}>Utilisateur</th>
								<th className={th}>Rôles</th>
								<th className={th}>Statut</th>
								<th className={th}>Dernière connexion</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{users.map((u) => (
								<tr key={u.id}>
									<td className={td}>
										<Link href={`/users/${u.id}`} className="group grid leading-tight">
											<span className="font-medium group-hover:underline">
												{u.name}
												{u.id === session.user.id && <span className="text-muted-foreground"> (vous)</span>}
											</span>
											<span className="text-xs text-muted-foreground">{u.email}</span>
										</Link>
									</td>
									<td className={td}>{u.roles.map((r) => r.name).join(", ")}</td>
									<td className={td}>
										<UserStatusBadge status={u.status} inviteExpired={u.inviteExpired} />
									</td>
									<td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
										{u.lastLoginAt
											? formatDate(u.lastLoginAt, { month: "short", hour: "2-digit", minute: "2-digit" })
											: "Jamais"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</FormCard>
		</ListTransitionProvider>
	);
}
