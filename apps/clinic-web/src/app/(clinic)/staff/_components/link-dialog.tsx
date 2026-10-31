"use client";

import { useTranslations } from "next-intl";
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
import type { Member, MemberLink } from "@/lib/team";
import { useFormat } from "@/lib/use-format";

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
	const t = useTranslations("team.link");
	const format = useFormat();
	const invitation = link.kind === "invitation";
	const sent = link.delivery === "sent";
	const message = t(invitation ? "inviteMessage" : "passwordMessage", { name: member.name, url: link.url });

	const copy = async () => {
		await navigator.clipboard.writeText(link.url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{invitation ? t("invited", { name: member.name }) : t("passwordTitle")}</DialogTitle>
				<DialogDescription>
					{invitation ? t("inviteHint") : t("passwordHint")}
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
					{sent
						? t.rich("sent", {
								email: member.email,
								strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
							})
						: link.delivery === "logged"
							? t("notConfigured")
							: t("failed")}
				</span>
			</p>

			<div className="grid gap-2">
				<div className="flex gap-2">
					<Input value={link.url} readOnly aria-label={t("label")} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
					<Button type="button" variant="outline" onClick={copy} className="shrink-0">
						{copied ? <LuCheck /> : <LuCopy />} {copied ? t("copied") : t("copy")}
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					{t("validity", { date: format.date(link.expiresAt), name: member.name })}
				</p>
			</div>

			<DialogFooter>
				<Button asChild variant="outline">
					<a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
						<FaWhatsapp /> {t("whatsapp")}
					</a>
				</Button>
				<Button onClick={onDone}>{t("done")}</Button>
			</DialogFooter>
		</>
	);
}
