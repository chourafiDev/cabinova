"use client";

import { LuChevronDown } from "react-icons/lu";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { PlatformUserStatus } from "@/lib/platform-users";
import { plural } from "@/lib/plural";
import { AccessLink } from "../_components/access-link";

/** Link (invitation or reset), sign out everywhere, reset 2FA, disable / re-enable. */
export function UserActions({
	userId,
	name,
	status,
	isSelf,
	twoFactorEnabled,
}: {
	userId: string;
	name: string;
	status: PlatformUserStatus;
	isSelf: boolean;
	twoFactorEnabled: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [link, setLink] = useState<{ url: string; isReset: boolean } | null>(null);
	const [confirmDisable, setConfirmDisable] = useState(false);
	const [confirmReset2fa, setConfirmReset2fa] = useState(false);

	const run = (fn: () => Promise<string | void>) =>
		startTransition(async () => {
			try {
				const message = await fn();
				if (message) toast.success(message);
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Action impossible");
			}
		});

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" disabled={pending}>
						Actions <LuChevronDown />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					{status !== "disabled" && (
						<DropdownMenuItem
							onSelect={() =>
								run(async () => {
									setLink(await api(`/platform-users/${userId}/link`, { method: "POST" }));
								})
							}
						>
							{status === "invited" ? "Renvoyer l’invitation" : "Envoyer un lien de nouveau mot de passe"}
						</DropdownMenuItem>
					)}
					{status === "active" && (
						<DropdownMenuItem
							onSelect={() =>
								run(async () => {
									const { revoked } = await api<{ revoked: number }>(`/platform-users/${userId}/sessions`, {
										method: "DELETE",
									});
									return `${plural(revoked, "session fermée", "sessions fermées")}`;
								})
							}
						>
							{isSelf ? "Déconnecter mes autres sessions" : "Déconnecter partout"}
						</DropdownMenuItem>
					)}
					{twoFactorEnabled && !isSelf && (
						<DropdownMenuItem onSelect={() => setConfirmReset2fa(true)}>Réinitialiser la double authentification</DropdownMenuItem>
					)}
					{status === "disabled" ? (
						<DropdownMenuItem
							onSelect={() =>
								run(async () => {
									await api(`/platform-users/${userId}/reactivate`, { method: "POST" });
									return "Compte réactivé";
								})
							}
						>
							Réactiver le compte
						</DropdownMenuItem>
					) : (
						!isSelf && (
							<DropdownMenuItem variant="destructive" onSelect={() => setConfirmDisable(true)}>
								Désactiver le compte
							</DropdownMenuItem>
						)
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={!!link} onOpenChange={(open) => !open && setLink(null)}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{link?.isReset ? "Lien de nouveau mot de passe" : "Nouvelle invitation"}</DialogTitle>
						<DialogDescription>Les liens envoyés précédemment ne fonctionnent plus.</DialogDescription>
					</DialogHeader>
					{link && <AccessLink url={link.url} isReset={link.isReset} />}
				</DialogContent>
			</Dialog>

			<Dialog open={confirmReset2fa} onOpenChange={setConfirmReset2fa}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Réinitialiser la double authentification de {name} ?</DialogTitle>
						<DialogDescription>
							À utiliser s’il a perdu son téléphone et ses codes de secours, après avoir vérifié son identité. Ses
							sessions sont fermées ; il se reconnecte avec son mot de passe seul puis réactive la 2FA.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmReset2fa(false)}>
							Annuler
						</Button>
						<Button
							variant="destructive"
							disabled={pending}
							onClick={() =>
								run(async () => {
									await api(`/platform-users/${userId}/2fa/reset`, { method: "POST" });
									setConfirmReset2fa(false);
									return "Double authentification réinitialisée";
								})
							}
						>
							Réinitialiser
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Désactiver {name} ?</DialogTitle>
						<DialogDescription>
							Ses sessions sont fermées immédiatement et il ne peut plus se connecter. Son historique est conservé ;
							vous pourrez réactiver le compte.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmDisable(false)}>
							Annuler
						</Button>
						<Button
							variant="destructive"
							disabled={pending}
							onClick={() =>
								run(async () => {
									await api(`/platform-users/${userId}/deactivate`, { method: "POST" });
									setConfirmDisable(false);
									return "Compte désactivé";
								})
							}
						>
							Désactiver
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
