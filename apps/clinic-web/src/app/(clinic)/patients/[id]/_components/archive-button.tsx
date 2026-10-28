"use client";

import { Archive, ArchiveRestore, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

/** Archive (with confirmation) or restore. Records are never deleted. */
export function ArchiveButton({ patientId, archived, name }: { patientId: string; archived: boolean; name: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);

	const run = async () => {
		setPending(true);
		try {
			await api(`/patients/${patientId}/${archived ? "restore" : "archive"}`, { method: "POST" });
			toast.success(archived ? "Dossier restauré" : "Dossier archivé");
			setOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setPending(false);
		}
	};

	if (archived) {
		return (
			<Button variant="outline" onClick={run} disabled={pending}>
				{pending ? <Loader className="animate-spin" /> : <ArchiveRestore />} Restaurer
			</Button>
		);
	}
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<Archive /> Archiver
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Archiver le dossier de {name} ?</DialogTitle>
					<DialogDescription>
						Le dossier quitte la liste des patients actifs mais reste consultable dans « Archivés ». Il n’est jamais
						supprimé et peut être restauré à tout moment.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Annuler
					</Button>
					<Button onClick={run} disabled={pending}>
						{pending && <Loader className="animate-spin" />} Archiver
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
