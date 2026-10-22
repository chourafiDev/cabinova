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

/** Health records are never deleted: archive hides the file from the list. */
export function ArchiveButton({ patientId, name, archived }: { patientId: string; name: string; archived: boolean }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	async function run() {
		setBusy(true);
		try {
			await api(`/patients/${patientId}/${archived ? "restore" : "archive"}`, { method: "POST" });
			toast.success(archived ? "Dossier restauré" : "Dossier archivé");
			setOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "L'action a échoué");
		} finally {
			setBusy(false);
		}
	}

	if (archived) {
		return (
			<Button type="button" variant="outline" onClick={run} disabled={busy}>
				{busy ? <Loader className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />}
				Restaurer
			</Button>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<Archive className="size-4" />
					Archiver
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Archiver le dossier de {name} ?</DialogTitle>
					<DialogDescription>
						Il n&apos;apparaît plus dans la liste des patients actifs et ne peut plus être modifié. Rien n&apos;est
						supprimé : vous pourrez le restaurer depuis l&apos;onglet « Archivés ».
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
						Annuler
					</Button>
					<Button type="button" onClick={run} disabled={busy}>
						{busy && <Loader className="size-4 animate-spin" />}
						Archiver
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
