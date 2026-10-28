"use client";

import { LuCircleCheck, LuLoader, LuSend, LuTriangleAlert } from "react-icons/lu";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { PlatformSettings } from "@/lib/settings";
import { Block, SectionForm, useSection } from "./section-form";

const addressOf = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from;

export function EmailSection({
	initial,
	delivery,
	readOnly,
}: {
	initial: PlatformSettings["email"];
	delivery: PlatformSettings["delivery"];
	readOnly: boolean;
}) {
	const s = useSection(
		{
			senderName: initial.senderName,
			senderAddress: initial.senderAddress ?? "",
			replyTo: initial.replyTo ?? "",
			signature: initial.signature ?? "",
		},
		"email",
	);
	const [testing, setTesting] = useState(false);
	const v = s.value;
	const defaultAddress = addressOf(delivery.defaultFrom);

	const test = async () => {
		setTesting(true);
		try {
			const r = await api<{ to: string; delivered: boolean }>("/settings/email/test", { method: "POST" });
			if (r.delivered) toast.success(`E-mail de test envoyé à ${r.to}`);
			else toast.info("Aucun service d’envoi configuré : l’e-mail a été écrit dans les journaux du serveur.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Envoi impossible");
		} finally {
			setTesting(false);
		}
	};

	return (
		<SectionForm
			title="E-mails"
			description="Comment vos e-mails se présentent aux cabinets et où arrivent leurs réponses."
			dirty={s.dirty}
			saving={s.saving}
			onSubmit={() => s.save()}
			onDiscard={s.discard}
			readOnly={readOnly}
		>
			<div
				className={
					delivery.provider
						? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
						: "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
				}
			>
				{delivery.provider ? <LuCircleCheck className="mt-0.5 size-4 shrink-0" /> : <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />}
				<span>
					{delivery.provider
						? "Envoi actif via Resend."
						: "Aucun service d’envoi : les e-mails sont seulement écrits dans les journaux du serveur. Ajoutez RESEND_API_KEY à la configuration de l’API pour les envoyer."}
				</span>
			</div>

			<Block title="Expéditeur">
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="senderName">Nom affiché</FieldLabel>
						<Input id="senderName" value={v.senderName} onChange={(e) => s.set({ senderName: e.target.value })} />
					</Field>
					<Field>
						<FieldLabel htmlFor="senderAddress">Adresse d’envoi</FieldLabel>
						<Input
							id="senderAddress"
							type="email"
							placeholder={defaultAddress}
							value={v.senderAddress}
							onChange={(e) => s.set({ senderAddress: e.target.value })}
						/>
						<FieldDescription>Son domaine doit être vérifié chez Resend. Vide : {defaultAddress}.</FieldDescription>
					</Field>
				</div>
				<p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
					De : {v.senderName || "—"} &lt;{v.senderAddress || defaultAddress}&gt;
					{v.replyTo && (
						<>
							<br />
							Répondre à : {v.replyTo}
						</>
					)}
				</p>
			</Block>

			<Block title="Réponses des cabinets">
				<Field className="sm:w-1/2">
					<FieldLabel htmlFor="replyTo">Adresse de réponse</FieldLabel>
					<Input
						id="replyTo"
						type="email"
						placeholder="support@cabinova.ma"
						value={v.replyTo}
						onChange={(e) => s.set({ replyTo: e.target.value })}
					/>
					<FieldDescription>
						Quand un cabinet répond à une facture ou à un ticket, son message arrive ici. Vide : il revient à l’adresse
						d’envoi.
					</FieldDescription>
				</Field>
			</Block>

			<Block title="Signature">
				<Field>
					<FieldLabel htmlFor="signature" className="sr-only">
						Signature
					</FieldLabel>
					<Textarea
						id="signature"
						rows={3}
						placeholder={"L’équipe Cabinova\nDu lundi au samedi, 9 h – 18 h"}
						value={v.signature}
						onChange={(e) => s.set({ signature: e.target.value })}
					/>
					<FieldDescription>Ajoutée en bas de chaque e-mail aux cabinets, avant le contact du support.</FieldDescription>
				</Field>
			</Block>

			{!readOnly && (
				<div className="flex flex-wrap items-center gap-3">
					<Button type="button" variant="outline" size="sm" disabled={testing || s.dirty} onClick={test}>
						{testing ? <LuLoader className="animate-spin" /> : <LuSend />} M’envoyer un e-mail de test
					</Button>
					{s.dirty && <span className="text-xs text-muted-foreground">Enregistrez d’abord vos modifications.</span>}
				</div>
			)}
		</SectionForm>
	);
}
