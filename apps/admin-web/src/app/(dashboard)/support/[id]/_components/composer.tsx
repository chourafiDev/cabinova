"use client";

import { Loader, Lock, Mail, PhoneIncoming, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, type TicketStatus } from "@/lib/support";
import { cn } from "@/lib/utils";

type Kind = "reply" | "note" | "clinic";
const KEEP = "__keep";

const MODES: Record<Kind, { label: string; icon: typeof Mail; placeholder: string; submit: string }> = {
	reply: { label: "Répondre", icon: Mail, placeholder: "Votre réponse au cabinet…", submit: "Envoyer" },
	note: { label: "Note interne", icon: Lock, placeholder: "Visible uniquement par l’équipe…", submit: "Ajouter la note" },
	clinic: {
		label: "Réponse du cabinet",
		icon: PhoneIncoming,
		placeholder: "Ce que le cabinet a répondu (téléphone, e-mail)…",
		submit: "Enregistrer",
	},
};

/** What the status becomes by default after each kind of message (same rule as the API). */
const nextStatus = (kind: Kind, current: TicketStatus): TicketStatus =>
	kind === "reply"
		? current === "open" || current === "in_progress"
			? "waiting"
			: current
		: kind === "clinic"
			? current === "in_progress"
				? "in_progress"
				: "open"
			: current;

/** Reply (e-mailed), internal note, or the cabinet's answer logged by the agent. */
export function Composer({
	ticketId,
	status,
	recipient,
}: {
	ticketId: string;
	status: TicketStatus;
	/** Where replies go; null disables replying. */
	recipient: string | null;
}) {
	const router = useRouter();
	const [kind, setKind] = useState<Kind>(recipient ? "reply" : "note");
	const [body, setBody] = useState("");
	const [after, setAfter] = useState<string>(KEEP);
	const [sending, setSending] = useState(false);
	const defaultNext = nextStatus(kind, status);
	const mode = MODES[kind];

	const send = async () => {
		if (!body.trim()) return;
		setSending(true);
		try {
			await api(`/support/tickets/${ticketId}/messages`, {
				method: "POST",
				body: JSON.stringify({ kind, body, ...(after !== KEEP && { status: after }) }),
			});
			toast.success(kind === "reply" ? `Réponse envoyée à ${recipient}` : kind === "note" ? "Note ajoutée" : "Réponse du cabinet enregistrée");
			setBody("");
			setAfter(KEEP);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Envoi impossible");
		} finally {
			setSending(false);
		}
	};

	return (
		<div
			className={cn(
				"grid gap-2 rounded-xl border bg-card p-3 shadow-xs",
				kind === "note" && "border-amber-200 bg-amber-50/40",
			)}
		>
			<div className="flex flex-wrap items-center gap-1 text-sm" role="tablist">
				{(Object.keys(MODES) as Kind[]).map((k) => {
					const Icon = MODES[k].icon;
					const disabled = k === "reply" && !recipient;
					return (
						<button
							key={k}
							type="button"
							role="tab"
							aria-selected={kind === k}
							disabled={disabled}
							title={disabled ? "Aucune adresse e-mail pour ce ticket" : undefined}
							onClick={() => {
								setKind(k);
								setAfter(KEEP);
							}}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40",
								kind === k && "bg-muted text-foreground",
							)}
						>
							<Icon className="size-3.5" /> {MODES[k].label}
						</button>
					);
				})}
				{kind === "reply" && recipient && <span className="ms-auto truncate text-xs text-muted-foreground">À : {recipient}</span>}
			</div>
			<Textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
				}}
				rows={4}
				placeholder={mode.placeholder}
				className="resize-y border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
				aria-label={mode.label}
			/>
			<div className="flex flex-wrap items-center gap-2 border-t pt-2">
				<span className="text-xs text-muted-foreground">Puis le ticket passe en</span>
				<Select value={after} onValueChange={setAfter}>
					<SelectTrigger size="sm" className="min-w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={KEEP}>
							{STATUS_LABELS[defaultNext]}
							{defaultNext === status ? " (inchangé)" : ""}
						</SelectItem>
						{(Object.keys(STATUS_LABELS) as TicketStatus[])
							.filter((s) => s !== defaultNext)
							.map((s) => (
								<SelectItem key={s} value={s}>
									{STATUS_LABELS[s]}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
				<span className="ms-auto hidden text-[11px] text-muted-foreground sm:inline">⌘ + Entrée</span>
				<Button size="sm" onClick={send} disabled={sending || !body.trim()} className="ms-auto sm:ms-0">
					{sending ? <Loader className="animate-spin" /> : <Send />} {mode.submit}
				</Button>
			</div>
		</div>
	);
}
