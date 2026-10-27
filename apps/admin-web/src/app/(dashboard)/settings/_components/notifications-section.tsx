"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PlatformSettings } from "@/lib/settings";
import { Block, SectionForm, useSection } from "./section-form";

type Notifications = PlatformSettings["notifications"];

function Toggle({
	label,
	hint,
	checked,
	onChange,
}: {
	label: string;
	hint: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="flex items-start justify-between gap-4">
			<span className="grid gap-0.5">
				<span className="text-sm">{label}</span>
				<span className="text-xs text-muted-foreground">{hint}</span>
			</span>
			<Switch checked={checked} onCheckedChange={onChange} />
		</label>
	);
}

export function NotificationsSection({ initial, readOnly }: { initial: Notifications; readOnly: boolean }) {
	const s = useSection(initial, "notifications");
	const [draft, setDraft] = useState("");
	const { cabinets, team } = s.value;
	const setCabinets = (p: Partial<Notifications["cabinets"]>) => s.set({ cabinets: { ...cabinets, ...p } });
	const setTeam = (p: Partial<Notifications["team"]>) => s.set({ team: { ...team, ...p } });

	const add = () => {
		const email = draft.trim().toLowerCase();
		if (!email) return;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Adresse e-mail invalide");
		if (team.recipients.includes(email)) return setDraft("");
		if (team.recipients.length >= 10) return toast.error("10 destinataires maximum");
		setTeam({ recipients: [...team.recipients, email] });
		setDraft("");
	};
	const alertsOn = team.incidents || team.databaseUnreachable || team.invoiceOverdue;

	return (
		<SectionForm
			title="Notifications"
			description="Les e-mails automatiques envoyés aux cabinets, et les alertes envoyées à votre équipe."
			dirty={s.dirty}
			saving={s.saving}
			onSubmit={() => s.save()}
			onDiscard={s.discard}
			readOnly={readOnly}
		>
			<Block
				title="Aux cabinets"
				caption="Les réponses aux tickets, les avertissements et avis de suspension pour impayé restent toujours envoyés."
			>
				<Toggle
					label="Fin d’essai proche"
					hint="Rappel quelques jours avant la fin de l’essai (délai dans Paiements)."
					checked={cabinets.trialEnding}
					onChange={(trialEnding) => setCabinets({ trialEnding })}
				/>
				<Toggle
					label="Nouvelle facture"
					hint="La facture et votre RIB, à l’émission."
					checked={cabinets.invoiceIssued}
					onChange={(invoiceIssued) => setCabinets({ invoiceIssued })}
				/>
				<Toggle
					label="Rappel de facture en retard"
					hint="Quand le délai de paiement est dépassé."
					checked={cabinets.invoiceOverdue}
					onChange={(invoiceOverdue) => setCabinets({ invoiceOverdue })}
				/>
				<Toggle
					label="Reçu de paiement"
					hint="Quand vous enregistrez un virement."
					checked={cabinets.paymentReceipt}
					onChange={(paymentReceipt) => setCabinets({ paymentReceipt })}
				/>
			</Block>

			<Block title="À l’équipe">
				<div className="grid gap-2">
					<span className="text-sm">Destinataires des alertes</span>
					{team.recipients.length > 0 && (
						<ul className="flex flex-wrap gap-1.5">
							{team.recipients.map((r) => (
								<li key={r} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 ps-2.5 pe-1 text-sm">
									{r}
									{!readOnly && (
										<button
											type="button"
											aria-label={`Retirer ${r}`}
											onClick={() => setTeam({ recipients: team.recipients.filter((x) => x !== r) })}
											className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
										>
											<X className="size-3.5" />
										</button>
									)}
								</li>
							))}
						</ul>
					)}
					<Input
						type="email"
						placeholder="Ajouter une adresse puis Entrée"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === ",") {
								e.preventDefault();
								add();
							}
						}}
						onBlur={add}
						className="sm:w-1/2"
					/>
					{alertsOn && team.recipients.length === 0 && (
						<p className="text-xs text-amber-800">Aucun destinataire : les alertes ci-dessous ne partent pas.</p>
					)}
				</div>
				<Toggle
					label="Incident ou ticket urgent"
					hint="Dès qu’un incident ou un ticket urgent est ouvert."
					checked={team.incidents}
					onChange={(incidents) => setTeam({ incidents })}
				/>
				<Toggle
					label="Base de cabinet injoignable"
					hint="Quand une base qui répondait ne répond plus."
					checked={team.databaseUnreachable}
					onChange={(databaseUnreachable) => setTeam({ databaseUnreachable })}
				/>
				<Toggle
					label="Facture en retard"
					hint="Quand une facture passe en retard de paiement."
					checked={team.invoiceOverdue}
					onChange={(invoiceOverdue) => setTeam({ invoiceOverdue })}
				/>
			</Block>
		</SectionForm>
	);
}
