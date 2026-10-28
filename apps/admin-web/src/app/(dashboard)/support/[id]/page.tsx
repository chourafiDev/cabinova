import { LuArrowLeft, LuBuilding2, LuClock, LuMail, LuMapPin, LuPhone, LuStar } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { CHANNEL_LABELS, FIRST_RESPONSE_HOURS, PRIORITY_LABELS, type SupportAgent, type TicketDetail } from "@/lib/support";
import { FormCard } from "../../_components/shared/form-card";
import { Deadline } from "../_components/tickets-table";
import { PriorityLabel, TicketStatusBadge, TicketTypeBadge } from "../_components/ticket-badges";
import { Composer } from "./_components/composer";
import { Conversation } from "./_components/conversation";
import { TicketPanel } from "./_components/ticket-panel";

export const metadata = { title: "Ticket" };

const clock = () => Date.now();
const when = (iso: string) => formatDate(iso, { month: "short", hour: "2-digit", minute: "2-digit" });

/** One ticket: the conversation on the left, how it's handled and who it's for on the right. */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "support:read")) notFound();
	const { id } = await params;
	const [ticket, agents] = await Promise.all([
		apiGet<TicketDetail>(`/support/tickets/${id}`),
		apiGet<SupportAgent[]>("/support/agents"),
	]);
	const canWrite = can(session.user.permissions, "support:write");
	const recipient = ticket.requesterEmail ?? ticket.cabinet?.email ?? null;
	const target = FIRST_RESPONSE_HOURS[ticket.priority][ticket.prioritySupport ? 1 : 0];
	const cabinet = ticket.cabinet;

	return (
		<>
			<div className="mb-4 flex items-start gap-3 border-b border-dashed border-foreground/20 pb-4">
				<Button asChild size="icon-sm" variant="ghost" aria-label="Retour au support" className="mt-0.5">
					<Link href="/support">
						<LuArrowLeft />
					</Link>
				</Button>
				<div className="grid min-w-0 gap-1">
					<h1 className="flex flex-wrap items-center gap-2 font-semibold">
						<span className="font-mono text-sm font-normal text-muted-foreground">{ticket.number}</span>
						<span className="break-words">{ticket.subject}</span>
					</h1>
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<TicketStatusBadge status={ticket.status} />
						<TicketTypeBadge type={ticket.type} />
						<PriorityLabel priority={ticket.priority} className="text-foreground" />
						<span>
							· Ouvert le {when(ticket.createdAt)} · {CHANNEL_LABELS[ticket.channel]}
						</span>
					</div>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
				<div className="grid gap-4">
					<Conversation messages={ticket.messages} cabinetName={cabinet?.name ?? null} />
					{canWrite && ticket.status !== "closed" && (
						<Composer ticketId={ticket.id} status={ticket.status} recipient={recipient} />
					)}
					{ticket.status === "closed" && (
						<p className="rounded-lg border border-dashed py-3 text-center text-sm text-muted-foreground">
							Ticket clôturé le {when(ticket.closedAt!)}. Rouvrez-le pour répondre.
						</p>
					)}
				</div>

				<aside className="grid gap-3 lg:sticky lg:top-4">
					<TicketPanel ticket={ticket} agents={agents} meId={session.user.id} canWrite={canWrite} />

					<FormCard title="Délai de première réponse">
						<div className="grid gap-1 text-sm">
							<div className="flex items-center gap-2">
								<LuClock className="size-4 text-muted-foreground" />
								{ticket.firstResponseAt ? (
									<span>Répondu le {when(ticket.firstResponseAt)}</span>
								) : (
									<Deadline ticket={ticket} now={clock()} />
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								Objectif {target < 24 ? `${target} h` : `${target / 24} j`} en priorité {PRIORITY_LABELS[ticket.priority].toLowerCase()}
								{ticket.prioritySupport ? " avec support prioritaire" : ""} · échéance {when(ticket.firstResponseDueAt)}
							</p>
						</div>
					</FormCard>

					<FormCard
						title="Cabinet"
						action={
							cabinet && (
								<Button asChild size="sm" variant="ghost">
									<Link href={`/tenants/${cabinet.id}`}>Fiche</Link>
								</Button>
							)
						}
					>
						{cabinet ? (
							<div className="grid gap-2 text-sm">
								<div className="flex flex-wrap items-center gap-2">
									<LuBuilding2 className="size-4 text-muted-foreground" />
									<span className="font-medium">{cabinet.name}</span>
									{cabinet.prioritySupport && (
										<Badge variant="outline" className="border-transparent bg-amber-50 text-amber-800">
											<LuStar className="fill-amber-400 text-amber-500" /> Support prioritaire
										</Badge>
									)}
								</div>
								<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
									<dt className="text-muted-foreground">Offre</dt>
									<dd>{cabinet.plan ?? "Aucune"}</dd>
									<dt className="text-muted-foreground">Responsable</dt>
									<dd>{cabinet.responsibleName}</dd>
								</dl>
								<div className="grid gap-1 text-xs text-muted-foreground">
									<a href={`mailto:${cabinet.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
										<LuMail className="size-3.5" /> {cabinet.email}
									</a>
									{cabinet.phone && (
										<a href={`tel:${cabinet.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
											<LuPhone className="size-3.5" /> {cabinet.phone}
										</a>
									)}
									{cabinet.city && (
										<span className="inline-flex items-center gap-1.5">
											<LuMapPin className="size-3.5" /> {cabinet.city}
										</span>
									)}
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Incident concernant toute la plateforme.</p>
						)}
					</FormCard>

					{ticket.otherTickets.length > 0 && (
						<FormCard title="Autres tickets du cabinet">
							<ul className="grid gap-2 text-sm">
								{ticket.otherTickets.map((t) => (
									<li key={t.id} className="flex items-center gap-2">
										<Link href={`/support/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
											<span className="font-mono text-[11px] text-muted-foreground">{t.number}</span> {t.subject}
										</Link>
										<TicketStatusBadge status={t.status} />
									</li>
								))}
							</ul>
						</FormCard>
					)}
				</aside>
			</div>
		</>
	);
}
