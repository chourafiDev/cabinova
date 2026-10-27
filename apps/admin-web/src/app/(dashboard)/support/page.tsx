import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiLifebuoy } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import {
	type CabinetOption,
	type SupportAgent,
	type SupportSummary,
	type TicketPage,
	type TicketView,
	VIEW_LABELS,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { InboxFilters } from "./_components/inbox-filters";
import { NewTicketDialog } from "./_components/new-ticket-dialog";
import { TicketsTable } from "./_components/tickets-table";

export const metadata = { title: "Support" };

const VIEWS: TicketView[] = ["active", "mine", "unassigned", "overdue", "waiting", "done", "all"];
const PER_PAGE = 25;
const clock = () => Date.now();

/**
 * Support et assistance — the inbox. Views are links (counts from the
 * API); type, priority and search refine the current view.
 */
export default async function SupportPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "support:read")) notFound();
	const params = await searchParams;
	const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
	const view = VIEWS.includes(get("view") as TicketView) ? (get("view") as TicketView) : "active";
	const page = Math.max(1, Number(get("page")) || 1);
	const filters = {
		...(get("type") && { type: get("type")! }),
		...(get("priority") && { priority: get("priority")! }),
		...(get("search") && { search: get("search")! }),
		...(get("tenantId") && { tenantId: get("tenantId")! }),
	};
	const canWrite = can(session.user.permissions, "support:write");
	const [summary, tickets, agents, cabinets] = await Promise.all([
		apiGet<SupportSummary>("/support/summary"),
		apiGet<TicketPage>(`/support/tickets?${new URLSearchParams({ view, ...filters, page: String(page), perPage: String(PER_PAGE) })}`),
		apiGet<SupportAgent[]>("/support/agents"),
		canWrite ? apiGet<CabinetOption[]>("/support/cabinets") : [],
	]);
	const href = (next: { view?: TicketView; page?: number }) => {
		const q = new URLSearchParams({
			...((next.view ?? view) !== "active" && { view: next.view ?? view }),
			...filters,
			...(next.page && next.page > 1 && { page: String(next.page) }),
		});
		return `/support${q.size ? `?${q}` : ""}`;
	};
	const countOf = (v: TicketView) => (v in summary ? summary[v as keyof SupportSummary] : null);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiLifebuoy />}
				total={tickets.total}
				label={{ singular: "Ticket", plural: "Tickets" }}
				action={
					canWrite && (
						<NewTicketDialog cabinets={cabinets} agents={agents} meId={session.user.id}>
							<Button>
								<Plus /> Nouveau ticket
							</Button>
						</NewTicketDialog>
					)
				}
			/>

			{summary.openIncidents > 0 && (
				<Link
					href="/support?type=incident"
					className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 hover:bg-red-100"
				>
					<span className="size-2 rounded-full bg-red-600" aria-hidden />
					{summary.openIncidents} incident{summary.openIncidents > 1 ? "s" : ""} en cours
					<span className="ms-auto text-xs underline">Voir</span>
				</Link>
			)}

			<div className="mb-3 grid gap-2">
				<nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px] text-sm" aria-label="Vues">
					{VIEWS.map((v) => {
						const n = countOf(v);
						return (
							<Link
								key={v}
								href={href({ view: v })}
								aria-current={v === view ? "page" : undefined}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-muted-foreground",
									v === view && "bg-background text-foreground shadow-sm",
								)}
							>
								{VIEW_LABELS[v]}
								{n !== null && n > 0 && (
									<span
										className={cn(
											"rounded-full px-1.5 text-[11px] tabular-nums",
											v === "overdue" ? "bg-red-100 text-red-700" : "bg-foreground/10",
										)}
									>
										{n}
									</span>
								)}
							</Link>
						);
					})}
				</nav>
				<InboxFilters />
				{!can(session.user.permissions, "support:all") && (
					<p className="text-xs text-muted-foreground">
						Vous voyez les tickets qui vous sont assignés et ceux qui ne sont assignés à personne.
					</p>
				)}
			</div>

			<FormCard contentClassName="p-0 overflow-x-auto">
				{tickets.data.length === 0 ? (
					<p className="py-10 text-center text-sm text-muted-foreground">
						{view === "active" && !Object.keys(filters).length ? "Aucun ticket à traiter." : "Aucun ticket pour ces filtres."}
					</p>
				) : (
					<TicketsTable tickets={tickets.data} now={clock()} />
				)}
				{tickets.pageCount > 1 && (
					<div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
						<span>
							Page {page} / {tickets.pageCount}
						</span>
						<Button asChild size="icon-sm" variant="outline" aria-label="Page précédente" className={cn(page <= 1 && "pointer-events-none opacity-50")}>
							<Link href={href({ page: page - 1 })} scroll={false}>
								<ChevronLeft />
							</Link>
						</Button>
						<Button
							asChild
							size="icon-sm"
							variant="outline"
							aria-label="Page suivante"
							className={cn(page >= tickets.pageCount && "pointer-events-none opacity-50")}
						>
							<Link href={href({ page: page + 1 })} scroll={false}>
								<ChevronRight />
							</Link>
						</Button>
					</div>
				)}
			</FormCard>
		</ListTransitionProvider>
	);
}
