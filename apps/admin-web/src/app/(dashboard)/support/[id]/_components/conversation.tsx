import { LuLock, LuMail } from "react-icons/lu";
import { formatDate } from "@/lib/format";
import type { TicketMessage } from "@/lib/support";
import { cn } from "@/lib/utils";

const initials = (name: string | null) =>
	(name ?? "?")
		.replace(/^Dr\.?\s+/i, "")
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join("");

const when = (iso: string) => formatDate(iso, { month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The ticket's story, oldest first: what the cabinet said, our replies
 * (e-mailed), internal notes, and status changes as quiet lines.
 */
export function Conversation({ messages, cabinetName }: { messages: TicketMessage[]; cabinetName: string | null }) {
	return (
		<ol className="grid gap-3">
			{messages.map((m) => {
				if (m.kind === "event") {
					return (
						<li key={m.id} className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
							<span className="h-px flex-1 bg-border" />
							<span className="text-center">
								{m.body.split("\n").join(" · ")} — {m.authorName ?? "Cabinova"}, {when(m.createdAt)}
							</span>
							<span className="h-px flex-1 bg-border" />
						</li>
					);
				}
				const fromClinic = m.kind === "clinic";
				return (
					<li key={m.id} className={cn("flex gap-3", !fromClinic && "flex-row-reverse")}>
						<span
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
								fromClinic ? "bg-sky-100 text-sky-800" : m.kind === "note" ? "bg-amber-100 text-amber-900" : "bg-primary/10 text-primary",
							)}
						>
							{initials(m.authorName)}
						</span>
						<div
							className={cn(
								"grid min-w-0 max-w-[85%] gap-1.5 rounded-xl border px-3.5 py-2.5",
								fromClinic && "rounded-tl-sm bg-card",
								m.kind === "reply" && "rounded-tr-sm border-primary/20 bg-primary/5",
								m.kind === "note" && "rounded-tr-sm border-amber-200 bg-amber-50/70",
							)}
						>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
								<span className="font-medium text-foreground">
									{m.authorName ?? (fromClinic ? "Le cabinet" : "Cabinova")}
								</span>
								{fromClinic && cabinetName && <span className="text-muted-foreground">{cabinetName}</span>}
								{m.kind === "note" && (
									<span className="inline-flex items-center gap-1 text-amber-800">
										<LuLock className="size-3" /> Note interne
									</span>
								)}
								<span className="text-muted-foreground">{when(m.createdAt)}</span>
							</div>
							<p className="whitespace-pre-line break-words text-sm leading-relaxed">{m.body}</p>
							{m.kind === "reply" && m.emailedTo && (
								<span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
									<LuMail className="size-3" /> Envoyé à {m.emailedTo}
								</span>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}
