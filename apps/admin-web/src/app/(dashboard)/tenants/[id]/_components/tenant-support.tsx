import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CabinetOption, SupportAgent, TicketPage } from "@/lib/support";
import { FormCard } from "../../../_components/shared/form-card";
import { NewTicketDialog } from "../../../support/_components/new-ticket-dialog";
import { TicketsTable } from "../../../support/_components/tickets-table";

const clock = () => Date.now();

/** The cabinet's tickets, newest activity first, with a shortcut to open one for it. */
export function TenantSupportTab({
	cabinet,
	tickets,
	agents,
	meId,
	canWrite,
}: {
	cabinet: CabinetOption;
	tickets: TicketPage;
	agents: SupportAgent[];
	meId: string;
	canWrite: boolean;
}) {
	return (
		<FormCard
			title={`Tickets · ${tickets.total}`}
			contentClassName="p-0 overflow-x-auto"
			action={
				<div className="flex gap-2">
					{tickets.total > tickets.data.length && (
						<Button asChild size="sm" variant="ghost">
							<Link href={`/support?view=all&tenantId=${cabinet.id}`}>Tout voir</Link>
						</Button>
					)}
					{canWrite && (
						<NewTicketDialog cabinets={[]} agents={agents} meId={meId} fixedCabinet={cabinet}>
							<Button size="sm">
								<Plus /> Nouveau ticket
							</Button>
						</NewTicketDialog>
					)}
				</div>
			}
		>
			{tickets.data.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">Aucun ticket pour ce cabinet.</p>
			) : (
				<TicketsTable tickets={tickets.data} now={clock()} hideCabinet />
			)}
		</FormCard>
	);
}
