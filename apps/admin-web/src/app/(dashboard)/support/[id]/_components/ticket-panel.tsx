"use client";

import { LuCheck, LuLoader, LuPencil, LuUserPlus } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
	PRIORITY_LABELS,
	STATUS_LABELS,
	type SupportAgent,
	type TicketDetail,
	type TicketPriority,
	type TicketStatus,
	TYPE_LABELS,
	type TicketType,
} from "@/lib/support";
import { FormCard } from "../../../_components/shared/form-card";
import { PriorityLabel } from "../../_components/ticket-badges";

const UNASSIGNED = "__none";

/** Status, priority, type, assignee and the cabinet contact — each change saves at once. */
export function TicketPanel({
	ticket,
	agents,
	meId,
	canWrite,
}: {
	ticket: TicketDetail;
	agents: SupportAgent[];
	meId: string;
	canWrite: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [editingContact, setEditingContact] = useState(false);
	const [contact, setContact] = useState({ name: ticket.requesterName ?? "", email: ticket.requesterEmail ?? "" });

	const patch = (body: Record<string, unknown>, message: string) =>
		startTransition(async () => {
			try {
				const result = await api<{ handedOver?: true }>(`/support/tickets/${ticket.id}`, {
					method: "PATCH",
					body: JSON.stringify(body),
				});
				if (result.handedOver) {
					// Assigned to a colleague: this agent no longer sees the ticket.
					toast.success(`${message} — le ticket ne figure plus dans votre liste`);
					router.push("/support");
					return;
				}
				toast.success(message);
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Modification impossible");
			}
		});

	const row = (label: string, control: React.ReactNode) => (
		<div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
			<span className="text-xs text-muted-foreground">{label}</span>
			{control}
		</div>
	);
	const done = ticket.status === "resolved" || ticket.status === "closed";
	const assignees = ticket.assignee && !agents.some((a) => a.id === ticket.assignee!.id) ? [...agents, ticket.assignee] : agents;

	return (
		<FormCard
			title="Traitement"
			action={pending && <LuLoader className="size-4 animate-spin text-muted-foreground" />}
		>
			<div className="grid gap-2.5">
				{row(
					"Statut",
					<Select
						value={ticket.status}
						disabled={!canWrite || pending}
						onValueChange={(v) => patch({ status: v }, `Statut : ${STATUS_LABELS[v as TicketStatus]}`)}
					>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
								<SelectItem key={s} value={s}>
									{STATUS_LABELS[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>,
				)}
				{row(
					"Priorité",
					<Select
						value={ticket.priority}
						disabled={!canWrite || pending}
						onValueChange={(v) => patch({ priority: v }, `Priorité : ${PRIORITY_LABELS[v as TicketPriority]}`)}
					>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
								<SelectItem key={p} value={p}>
									<PriorityLabel priority={p} className="text-sm" />
								</SelectItem>
							))}
						</SelectContent>
					</Select>,
				)}
				{row(
					"Type",
					<Select
						value={ticket.type}
						disabled={!canWrite || pending}
						onValueChange={(v) => patch({ type: v }, `Type : ${TYPE_LABELS[v as TicketType]}`)}
					>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(TYPE_LABELS) as TicketType[]).map((t) => (
								<SelectItem key={t} value={t}>
									{TYPE_LABELS[t]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>,
				)}
				{row(
					"Assigné à",
					<Select
						value={ticket.assignee?.id ?? UNASSIGNED}
						disabled={!canWrite || pending}
						onValueChange={(v) =>
							patch({ assigneeId: v === UNASSIGNED ? null : v }, v === UNASSIGNED ? "Ticket désassigné" : "Ticket assigné")
						}
					>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
							{assignees.map((a) => (
								<SelectItem key={a.id} value={a.id}>
									{a.name}
									{a.id === meId && " (moi)"}
								</SelectItem>
							))}
						</SelectContent>
					</Select>,
				)}

				{canWrite && (
					<div className="flex flex-wrap gap-2 pt-1">
						{ticket.assignee?.id !== meId && agents.some((a) => a.id === meId) && !done && (
							<Button size="sm" variant="outline" disabled={pending} onClick={() => patch({ assigneeId: meId }, "Ticket pris en charge")}>
								<LuUserPlus /> Me l’assigner
							</Button>
						)}
						{!done ? (
							<Button size="sm" variant="outline" disabled={pending} onClick={() => patch({ status: "resolved" }, "Ticket résolu")}>
								<LuCheck /> Marquer résolu
							</Button>
						) : (
							<Button size="sm" variant="outline" disabled={pending} onClick={() => patch({ status: "open" }, "Ticket rouvert")}>
								Rouvrir
							</Button>
						)}
					</div>
				)}

				{ticket.cabinet !== null || ticket.requesterEmail ? (
					<div className="mt-1 grid gap-1.5 border-t pt-3">
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">Contact du ticket</span>
							{canWrite && !editingContact && (
								<Button size="icon-sm" variant="ghost" aria-label="Modifier le contact" onClick={() => setEditingContact(true)}>
									<LuPencil />
								</Button>
							)}
						</div>
						{editingContact ? (
							<div className="grid gap-2">
								<Input
									className="h-8"
									value={contact.name}
									placeholder={ticket.cabinet?.responsibleName ?? "Nom"}
									onChange={(e) => setContact({ ...contact, name: e.target.value })}
									aria-label="Nom du contact"
								/>
								<Input
									className="h-8"
									type="email"
									value={contact.email}
									placeholder={ticket.cabinet?.email ?? "E-mail"}
									onChange={(e) => setContact({ ...contact, email: e.target.value })}
									aria-label="E-mail du contact"
								/>
								<div className="flex justify-end gap-2">
									<Button size="sm" variant="ghost" onClick={() => setEditingContact(false)}>
										Annuler
									</Button>
									<Button
										size="sm"
										disabled={pending}
										onClick={() => {
											patch({ requesterName: contact.name, requesterEmail: contact.email }, "Contact mis à jour");
											setEditingContact(false);
										}}
									>
										Enregistrer
									</Button>
								</div>
							</div>
						) : (
							<div className="grid text-sm leading-tight">
								<span>{ticket.requesterName ?? ticket.cabinet?.responsibleName ?? "—"}</span>
								<span className="text-xs text-muted-foreground">
									{ticket.requesterEmail ?? ticket.cabinet?.email ?? "Pas d’e-mail"}
								</span>
							</div>
						)}
					</div>
				) : null}
			</div>
		</FormCard>
	);
}
