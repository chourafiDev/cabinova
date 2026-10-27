import { MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { TicketRow } from "@/lib/support";
import { cn } from "@/lib/utils";
import { PriorityLabel, TicketStatusBadge, TicketTypeBadge } from "./ticket-badges";

const span = (ms: number) => {
	const m = Math.round(Math.abs(ms) / 60_000);
	if (m < 60) return `${m} min`;
	const h = Math.round(m / 60);
	return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`;
};

/** First-answer deadline: answered, time left, or how late. */
export function Deadline({ ticket, now }: { ticket: Pick<TicketRow, "status" | "firstResponseAt" | "firstResponseDueAt" | "overdue">; now: number }) {
	if (ticket.firstResponseAt) return <span className="text-xs text-muted-foreground">Répondu</span>;
	if (ticket.status === "resolved" || ticket.status === "closed") return <span className="text-xs text-muted-foreground">—</span>;
	const left = new Date(ticket.firstResponseDueAt).getTime() - now;
	return ticket.overdue ? (
		<span className="text-xs font-medium text-destructive">En retard de {span(left)}</span>
	) : (
		<span className={cn("text-xs", left < 2 * 3_600_000 ? "font-medium text-amber-700" : "text-muted-foreground")}>
			Reste {span(left)}
		</span>
	);
}

/** The ticket list, used by the inbox and by a cabinet's Support tab. */
export function TicketsTable({ tickets, now, hideCabinet }: { tickets: TicketRow[]; now: number; hideCabinet?: boolean }) {
	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";
	return (
		<table className="w-full min-w-[860px] text-sm">
			<thead>
				<tr className="border-b">
					<th className={th}>Ticket</th>
					{!hideCabinet && <th className={th}>Cabinet</th>}
					<th className={th}>Priorité</th>
					<th className={th}>Statut</th>
					<th className={th}>Assigné</th>
					<th className={th}>1ʳᵉ réponse</th>
					<th className={cn(th, "text-end")}>Activité</th>
				</tr>
			</thead>
			<tbody className="divide-y">
				{tickets.map((t) => (
					<tr key={t.id} className={cn("hover:bg-muted/40", t.overdue && "bg-red-50/40")}>
						<td className={cn(td, "max-w-96")}>
							<Link href={`/support/${t.id}`} className="group grid gap-0.5 leading-tight">
								<span className="flex items-center gap-1.5">
									<span className="font-mono text-[11px] text-muted-foreground">{t.number}</span>
									{t.type !== "assistance" && <TicketTypeBadge type={t.type} />}
								</span>
								<span className="truncate font-medium group-hover:underline">{t.subject}</span>
								<span className="flex items-center gap-2 text-xs text-muted-foreground">
									{t.requesterName && <span className="truncate">{t.requesterName}</span>}
									<span className="inline-flex items-center gap-0.5">
										<MessageSquare className="size-3" />
										{t.messageCount}
									</span>
								</span>
							</Link>
						</td>
						{!hideCabinet && (
							<td className={td}>
								{t.tenant ? (
									<span className="inline-flex items-center gap-1">
										<Link href={`/tenants/${t.tenant.id}?tab=support`} className="hover:underline">
											{t.tenant.name}
										</Link>
										{t.prioritySupport && (
											<Star className="size-3 fill-amber-400 text-amber-500" aria-label="Support prioritaire" />
										)}
									</span>
								) : (
									<span className="text-muted-foreground">Toute la plateforme</span>
								)}
							</td>
						)}
						<td className={td}>
							<PriorityLabel priority={t.priority} />
						</td>
						<td className={td}>
							<TicketStatusBadge status={t.status} />
						</td>
						<td className={td}>{t.assignee?.name ?? <span className="text-muted-foreground">—</span>}</td>
						<td className={td}>
							<Deadline ticket={t} now={now} />
						</td>
						<td className={cn(td, "whitespace-nowrap text-end text-xs text-muted-foreground")}>
							{formatDate(t.lastActivityAt, { month: "short", year: undefined, hour: "2-digit", minute: "2-digit" })}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
