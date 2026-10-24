"use client";

import { ChevronDown } from "lucide-react";
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

/** Link (invitation or reset), sign out everywhere, disable / re-enable. */
export function UserActions({
	userId,
	name,
	status,
	isSelf,
}: {
	userId: string;
	name: string;
	status: PlatformUserStatus;
	isSelf: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [link, setLink] = useState<{ url: string; isReset: boolean } | null>(null);
	const [confirmDisable, setConfirmDisable] = useState(false);

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
						Actions <ChevronDown />
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
