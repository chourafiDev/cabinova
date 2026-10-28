"use client";

import { Loader } from "lucide-react";
import { useState } from "react";
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
import { api } from "@/lib/api-client";

/** Confirms archiving (or restoring) a file. Records are never deleted. `onDone` refreshes the views. */
export function ArchiveDialog({
	open,
	onOpenChange,
	patientId,
	archived,
	name,
	onDone,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	patientId: string;
	archived: boolean;
	name: string;
	onDone: () => void;
}) {
	const [pending, setPending] = useState(false);

	const run = async () => {
		setPending(true);
		try {
			await api(`/patients/${patientId}/${archived ? "restore" : "archive"}`, { method: "POST" });
			toast.success(archived ? "Dossier restauré" : "Dossier archivé");
			onOpenChange(false);
			onDone();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{archived ? `Restaurer le dossier de ${name} ?` : `Archiver le dossier de ${name} ?`}</DialogTitle>
					<DialogDescription>
						{archived
							? "Le dossier revient dans la liste des patients actifs et peut de nouveau être modifié."
							: "Le dossier quitte la liste des patients actifs mais reste consultable dans « Archivés ». Il n’est jamais supprimé et peut être restauré à tout moment."}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
					<Button onClick={run} disabled={pending}>
						{pending && <Loader className="animate-spin" />} {archived ? "Restaurer" : "Archiver"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
