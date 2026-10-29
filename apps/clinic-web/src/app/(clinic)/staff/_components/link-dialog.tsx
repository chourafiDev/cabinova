"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { LuCheck, LuCircleAlert, LuCopy, LuMailCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { Member, MemberLink } from "@/lib/team";

/**
 * The link just issued (invitation or new password): shown once, since
 * only its hash is kept. The e-mail may have gone; it can also be copied
 * or sent by WhatsApp.
 */
export function LinkDialog({
	value,
	onOpenChange,
}: {
	value: { member: Member; link: MemberLink } | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={value !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{value && <LinkContent {...value} onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function LinkContent({ member, link, onDone }: { member: Member; link: MemberLink; onDone: () => void }) {
	const [copied, setCopied] = useState(false);
	const invitation = link.kind === "invitation";
	const sent = link.delivery === "sent";
	const message = invitation
		? `Bonjour ${member.name}, voici votre lien pour rejoindre le cabinet et choisir votre mot de passe : ${link.url}`
		: `Bonjour ${member.name}, voici votre lien pour choisir un nouveau mot de passe : ${link.url}`;

	const copy = async () => {
		await navigator.clipboard.writeText(link.url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{invitation ? `${member.name} est invité(e)` : "Lien de mot de passe créé"}</DialogTitle>
				<DialogDescription>
					{invitation
						? "Il ou elle rejoint le cabinet en choisissant son mot de passe avec ce lien."
						: "Son mot de passe actuel reste valable jusqu’à ce qu’il ou elle en choisisse un nouveau."}
				</DialogDescription>
			</DialogHeader>

			<p
				className={
					sent
						? "flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
						: "flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
				}
			>
				{sent ? <LuMailCheck className="mt-0.5 size-4 shrink-0" /> : <LuCircleAlert className="mt-0.5 size-4 shrink-0" />}
				<span>
					{sent ? (
						<>
							E-mail envoyé à <strong className="font-medium">{member.email}</strong>.
						</>
					) : link.delivery === "logged" ? (
						"L’envoi d’e-mails n’est pas configuré : transmettez-lui ce lien vous-même."
					) : (
						"L’e-mail n’a pas pu être envoyé : transmettez-lui ce lien vous-même."
					)}
				</span>
			</p>

			<div className="grid gap-2">
				<div className="flex gap-2">
					<Input value={link.url} readOnly aria-label="Lien" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
					<Button type="button" variant="outline" onClick={copy} className="shrink-0">
						{copied ? <LuCheck /> : <LuCopy />} {copied ? "Copié" : "Copier"}
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					Valable jusqu’au {formatDate(link.expiresAt)}, une seule fois. Ne le transmettez qu’à {member.name} : il donne
					accès au cabinet.
				</p>
			</div>

			<DialogFooter>
				<Button asChild variant="outline">
					<a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
						<FaWhatsapp /> Envoyer par WhatsApp
					</a>
				</Button>
				<Button onClick={onDone}>Terminé</Button>
			</DialogFooter>
		</>
	);
}
