import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { MemberDetail, PermissionInfo, Role } from "@/lib/team";
import { MemberStatus } from "../_components/member-status";
import { MemberAccessForm } from "./_components/member-access-form";

export const metadata = { title: "Rôles et permissions" };

export default async function MemberPage({ params }: PageProps<"/staff/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "users:read")) notFound();
	const [member, roles, permissions] = await Promise.all([
		apiGet<MemberDetail>(`/users/${id}`),
		apiGet<Role[]>("/roles"),
		apiGet<PermissionInfo[]>("/permissions"),
	]);
	const isMe = member.id === session.user.id;
	const canWrite = can(session.user.permissions, "users:write");

	return (
		<>
			<div className="mb-4 flex items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild variant="outline" size="icon-sm" aria-label="Retour à l'équipe">
					<Link href="/staff">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="grid min-w-0 leading-tight">
					<h1 className="truncate font-semibold">{member.name}</h1>
					<span className="text-muted-foreground truncate text-xs">{member.email}</span>
				</div>
				<div className="ms-auto">
					<MemberStatus member={member} />
				</div>
			</div>
			<MemberAccessForm
				key={JSON.stringify([member.roles, member.overrides])}
				member={member}
				roles={roles}
				permissions={permissions}
				readOnlyReason={
					isMe
						? "Vous ne pouvez pas modifier votre propre accès."
						: !canWrite
							? "Vous pouvez consulter ces accès, pas les modifier."
							: null
				}
			/>
		</>
	);
}
