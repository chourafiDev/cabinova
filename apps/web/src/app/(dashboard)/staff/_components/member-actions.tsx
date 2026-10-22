"use client";

import { Ban, KeyRound, Loader, MoreHorizontal, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { Member } from "@/lib/team";
import { AccessLink } from "./access-link";

type DialogKind = "link" | "deactivate" | null;

/** "⋯" menu on a team member row. */
export function MemberActions({ member, canWrite }: { member: Member; canWrite: boolean }) {
	const router = useRouter();
	const [dialog, setDialog] = useState<DialogKind>(null);
	const [link, setLink] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [, startRefresh] = useTransition();

	/** Calls the API; on success toasts and refreshes the list. */
	const run = async <T,>(call: () => Promise<T>, success?: string) => {
		setBusy(true);
		try {
			const result = await call();
			if (success) toast.success(success);
			startRefresh(() => router.refresh());
			return result;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "L'action a échoué");
		} finally {
			setBusy(false);
		}
	};

	async function newLink() {
		setLink(null);
		setDialog("link");
		const res = await run(() =>
			api<{ token: string; url: string }>(`/users/${member.id}/access-link`, { method: "POST" }),
		);
		if (res) setLink(res.url);
		else setDialog(null);
	}

	const setActive = (active: boolean) =>
		run(
			() =>
				api(`/users/${member.id}/status`, {
					method: "PATCH",
					body: JSON.stringify({ active }),
				}),
			active ? "Compte réactivé" : "Compte désactivé",
		).then(() => setDialog(null));

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="ghost" size="icon" aria-label={`Actions pour ${member.name}`}>
						<MoreHorizontal className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="sm:min-w-64">
					<DropdownMenuItem asChild>
						<Link href={`/staff/${member.id}`}>
							<UserCog />
							Rôles et permissions
						</Link>
					</DropdownMenuItem>
					{canWrite && (
						<>
							<DropdownMenuItem onSelect={newLink}>
								<KeyRound />
								{member.hasPassword ? "Lien de réinitialisation" : "Nouveau lien d'invitation"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{member.active ? (
								<DropdownMenuItem variant="destructive" onSelect={() => setDialog("deactivate")}>
									<Ban />
									Désactiver
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onSelect={() => setActive(true)}>
									<ShieldCheck />
									Réactiver
								</DropdownMenuItem>
							)}
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={dialog !== null} onOpenChange={(next) => !next && !busy && setDialog(null)}>
				<DialogContent className="sm:max-w-[520px]">
					{dialog === "link" && (
						<>
							<DialogHeader>
								<DialogTitle>
									{member.hasPassword ? "Lien de réinitialisation" : "Lien d'invitation"}
								</DialogTitle>
								<DialogDescription>
									{link ? (
										<>
											Un e-mail a été envoyé à {member.name} pour qu&apos;il choisisse{" "}
											{member.hasPassword ? "un nouveau" : "son"} mot de passe. Valable 7 jours, usage
											unique ; les liens précédents ne fonctionnent plus. Vous pouvez aussi copier le
											lien ci-dessous :
										</>
									) : (
										"Envoi de l'e-mail en cours…"
									)}
								</DialogDescription>
							</DialogHeader>
							{link ? (
								<AccessLink url={link} />
							) : (
								<Loader className="text-primary mx-auto size-5 animate-spin" />
							)}
							<DialogFooter>
								<Button type="button" onClick={() => setDialog(null)}>
									Terminé
								</Button>
							</DialogFooter>
						</>
					)}

					{dialog === "deactivate" && (
						<>
							<DialogHeader>
								<DialogTitle>Désactiver {member.name} ?</DialogTitle>
								<DialogDescription>
									Il est déconnecté immédiatement et ne pourra plus se connecter, jusqu&apos;à réactivation.
									Son historique (consultations, factures) est conservé.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>
									Annuler
								</Button>
								<Button type="button" variant="destructive" disabled={busy} onClick={() => setActive(false)}>
									{busy && <Loader className="size-4 animate-spin" />}
									Désactiver
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
