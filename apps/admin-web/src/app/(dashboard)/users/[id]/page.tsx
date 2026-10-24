import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { PermissionInfo, PlatformRole, PlatformUserDetail, UserHistoryEntry } from "@/lib/platform-users";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { FormCard } from "../../_components/shared/form-card";
import { UserStatusBadge } from "../_components/user-status-badge";
import { AccessForm } from "./access-form";
import { UserActions } from "./user-actions";

export async function generateMetadata({ params }: PageProps<"/users/[id]">) {
	const user = await apiGet<PlatformUserDetail>(`/platform-users/${(await params).id}`);
	return { title: user.name };
}

const dateTime = (value: string) => formatDate(value, { month: "short", hour: "2-digit", minute: "2-digit" });

const HISTORY_LABELS: Record<string, string> = {
	"platform_user.invite": "Invitation envoyée",
	"platform_user.update": "Accès modifiés",
	"platform_user.deactivate": "Compte désactivé",
	"platform_user.reactivate": "Compte réactivé",
	"platform_user.link": "Nouveau lien envoyé",
	"platform_user.sessions_revoke": "Sessions fermées",
};

const initials = (name: string) =>
	name
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join("");

/** "Mozilla/5.0 (Macintosh…) Chrome/…" → "Chrome · macOS" (good enough to recognise a device). */
function device(userAgent: string | null) {
	if (!userAgent) return { label: "Appareil inconnu", mobile: false };
	const browser =
		/Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Navigateur";
	const os = /iPhone|iPad/.test(userAgent)
		? "iOS"
		: /Android/.test(userAgent)
			? "Android"
			: /Mac OS X/.test(userAgent)
				? "macOS"
				: /Windows/.test(userAgent)
					? "Windows"
					: /Linux/.test(userAgent)
						? "Linux"
						: "";
	return { label: [browser, os].filter(Boolean).join(" · "), mobile: /Mobile|iPhone|Android/.test(userAgent) };
}

/** Module 5 — one central user: role, permissions, profile, sessions, history. */
export default async function UserPage({ params }: PageProps<"/users/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "users:read")) notFound();
	const [user, roles, catalog, history] = await Promise.all([
		apiGet<PlatformUserDetail>(`/platform-users/${id}`),
		apiGet<PlatformRole[]>("/platform-roles"),
		apiGet<PermissionInfo[]>("/platform-permissions"),
		apiGet<UserHistoryEntry[]>(`/platform-users/${id}/history`),
	]);
	const mine = session.user.permissions;
	const isSelf = user.id === session.user.id;
	// The API refuses managing someone holding a permission you don't have.
	const beyondMe = user.permissions.some((p) => !mine.includes(p));
	const canManage = can(mine, "users:write") && !beyondMe;

	return (
		<>
			<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour aux utilisateurs">
					<Link href="/users">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
					{initials(user.name)}
				</span>
				<div className="grid min-w-0 leading-tight">
					<h1 className="flex flex-wrap items-center gap-2 font-semibold">
						<span className="truncate">{user.name}</span>
						{isSelf && <span className="text-sm font-normal text-muted-foreground">(vous)</span>}
						<UserStatusBadge status={user.status} inviteExpired={user.inviteExpired} />
					</h1>
					<span className="truncate text-xs text-muted-foreground">
						{user.email} · {user.roles.map((r) => r.name).join(", ")} ·{" "}
						{user.lastLoginAt ? `vu(e) le ${dateTime(user.lastLoginAt)}` : "jamais connecté(e)"}
					</span>
				</div>
				{canManage && (
					<div className="ms-auto">
						<UserActions userId={user.id} name={user.name} status={user.status} isSelf={isSelf} />
					</div>
				)}
			</div>

			{beyondMe && can(mine, "users:write") && (
				<p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
					Cet utilisateur a des permissions que vous n’avez pas : vous pouvez seulement consulter son accès.
				</p>
			)}

			<AccessForm
				user={user}
				roles={roles}
				catalog={catalog}
				myPermissions={mine}
				readOnly={!canManage}
				isSelf={isSelf}
				aside={
					<>
						<FormCard title={`Sessions ouvertes · ${user.sessions.length}`}>
							{user.sessions.length === 0 ? (
								<p className="text-sm text-muted-foreground">Aucune session active.</p>
							) : (
								<ul className="grid gap-2.5">
									{user.sessions.map((s) => {
										const { label, mobile } = device(s.userAgent);
										const Icon = mobile ? Smartphone : Monitor;
										return (
											<li key={s.id} className="flex items-start gap-2.5 text-sm">
												<span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
													<Icon className="size-3.5 text-muted-foreground" />
												</span>
												<span className="grid min-w-0 leading-tight">
													<span className="font-medium">{label}</span>
													<span className="truncate text-xs text-muted-foreground">
														{s.ip ?? "IP inconnue"} · depuis le {dateTime(s.createdAt)}
													</span>
												</span>
											</li>
										);
									})}
								</ul>
							)}
						</FormCard>

						<FormCard title="Historique">
							{history.length === 0 ? (
								<p className="text-sm text-muted-foreground">Aucun événement.</p>
							) : (
								<ol className="relative grid gap-3 border-s ps-4">
									{history.map((h) => (
										<li key={h.id} className="relative grid text-sm leading-tight">
											<span className="absolute -start-[21px] top-1 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
											<span className="font-medium">{HISTORY_LABELS[h.action] ?? h.action}</span>
											<span className="text-xs text-muted-foreground">
												{h.actor?.name ?? "Système"} · {dateTime(h.createdAt)}
											</span>
										</li>
									))}
								</ol>
							)}
						</FormCard>
					</>
				}
			/>
		</>
	);
}
