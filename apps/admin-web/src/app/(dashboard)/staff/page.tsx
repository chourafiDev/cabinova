import Link from "next/link";
import { notFound } from "next/navigation";
import { HiIdentification } from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { Member, Role } from "@/lib/team";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { InviteMemberDialog } from "./_components/invite-member-dialog";
import { MemberActions } from "./_components/member-actions";
import { MemberStatus } from "./_components/member-status";

export const metadata = { title: "Équipe" };

export default async function StaffPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "users:read")) notFound();
	const canWrite = can(session.user.permissions, "users:write");
	const [members, roles] = await Promise.all([apiGet<Member[]>("/users"), apiGet<Role[]>("/roles")]);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiIdentification />}
				total={members.length}
				label={{ singular: "Membre", plural: "Membres" }}
				action={canWrite ? <InviteMemberDialog roles={roles} /> : undefined}
			/>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Membre</TableHead>
							<TableHead>Rôles</TableHead>
							<TableHead>Statut</TableHead>
							<TableHead>Dernière connexion</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.map((m) => {
							const isMe = m.id === session.user.id;
							return (
								<TableRow key={m.id}>
									<TableCell>
										<Link href={`/staff/${m.id}`} className="grid leading-tight hover:underline">
											<span className="font-medium">
												{m.name}
												{isMe && (
													<span className="text-muted-foreground ms-1.5 text-xs font-normal">(vous)</span>
												)}
											</span>
											<span className="text-muted-foreground text-xs">{m.email}</span>
										</Link>
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap gap-1">
											{m.roles.length ? (
												m.roles.map((r) => (
													<Badge key={r.id} variant="outline" className="bg-primary/10 text-primary border-transparent">
														{r.name}
													</Badge>
												))
											) : (
												<span className="text-muted-foreground text-xs">Aucun</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<MemberStatus member={m} />
									</TableCell>
									<TableCell className="text-muted-foreground">
										{m.lastLoginAt
											? formatDate(m.lastLoginAt, { month: "short", hour: "2-digit", minute: "2-digit" })
											: "Jamais connecté"}
									</TableCell>
									<TableCell>{!isMe && <MemberActions member={m} canWrite={canWrite} />}</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</ListTransitionProvider>
	);
}
