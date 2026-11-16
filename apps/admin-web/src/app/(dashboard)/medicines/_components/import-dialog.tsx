"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconDocument, IconSpinner, IconUpload, IconWarning } from "@/components/icons";
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
import type { ImportResult } from "@/lib/medicines";
import { cn } from "@/lib/utils";

const MAX_BYTES = 20 * 1024 * 1024;

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

/**
 * "Importer": the AMMPS export (.xlsx) dropped or picked, sent, then what
 * changed — or why nothing did (unreadable file, safety rule).
 */
export function ImportDialog({ busy }: { busy: boolean }) {
	const router = useRouter();
	const input = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<ImportResult | null>(null);

	const reset = () => {
		setFile(null);
		setError(null);
		setResult(null);
		if (input.current) input.current.value = "";
	};

	const pick = (next: File | undefined) => {
		setResult(null);
		if (!next) return;
		if (!/\.xlsx$/i.test(next.name)) return setError("Choisissez l’export Excel de l’AMMPS (.xlsx).");
		if (next.size > MAX_BYTES) return setError("Fichier trop volumineux (20 Mo au maximum).");
		setError(null);
		setFile(next);
	};

	const send = async () => {
		if (!file) return;
		setSending(true);
		setError(null);
		try {
			const body = new FormData();
			body.append("file", file);
			// No Content-Type: the browser sets the multipart boundary.
			const res = await fetch("/api/medicines/imports", { method: "POST", body });
			const json = await res.json().catch(() => null);
			if (!res.ok) throw new Error(json?.message ?? "Import impossible");
			const answer = json as ImportResult;
			setResult(answer);
			if (answer.import.status === "success") toast.success("Liste des médicaments mise à jour");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import impossible");
		} finally {
			setSending(false);
		}
	};

	const run = result?.import;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (sending) return;
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm" disabled={busy} title={busy ? "Un import est déjà en cours" : undefined}>
					<IconUpload /> Importer la liste AMMPS
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Importer la liste AMMPS</DialogTitle>
					<DialogDescription>
						L’export Excel de la recherche de médicaments de l’AMMPS. La liste de tous les cabinets est mise à jour en une
						fois.
					</DialogDescription>
				</DialogHeader>

				{run ? (
					<ImportOutcome result={result} />
				) : (
					<div className="grid gap-3">
						<button
							type="button"
							onClick={() => input.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setDragging(true);
							}}
							onDragLeave={() => setDragging(false)}
							onDrop={(e) => {
								e.preventDefault();
								setDragging(false);
								pick(e.dataTransfer.files[0]);
							}}
							disabled={sending}
							className={cn(
								"grid place-items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition-colors hover:bg-muted/50",
								dragging && "border-primary bg-primary/5",
							)}
						>
							{file ? (
								<>
									<IconDocument className="size-6 text-primary" />
									<span className="font-medium break-all">{file.name}</span>
									<span className="text-xs text-muted-foreground">{size(file.size)} · cliquer pour en choisir un autre</span>
								</>
							) : (
								<>
									<IconUpload className="size-6 text-muted-foreground" />
									<span className="font-medium">Déposez le fichier .xlsx ici</span>
									<span className="text-xs text-muted-foreground">ou cliquez pour le choisir · 20 Mo au maximum</span>
								</>
							)}
						</button>
						<input
							ref={input}
							type="file"
							accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							className="hidden"
							onChange={(e) => pick(e.target.files?.[0])}
						/>
						<ul className="grid gap-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
							<li>· Colonnes reconnues par leur titre : ID AMMPS, Nom commercial, Substance active, Dosage, Forme, Présentation, Laboratoire, Statut, PPV, PH.</li>
							<li>· Rien n’est supprimé : un médicament absent du fichier est seulement retiré de la liste proposée.</li>
							<li>· Refusé sans rien changer si le fichier contient moins de 80 % des médicaments actifs, ou trop de lignes illisibles.</li>
						</ul>
						{error && (
							<p className="flex items-start gap-2 text-sm text-destructive">
								<IconWarning className="mt-0.5 size-4 shrink-0" /> {error}
							</p>
						)}
					</div>
				)}

				<DialogFooter>
					{run ? (
						<>
							<Button variant="outline" onClick={reset}>
								Importer un autre fichier
							</Button>
							<Button onClick={() => setOpen(false)}>Fermer</Button>
						</>
					) : (
						<Button onClick={send} disabled={!file || sending}>
							{sending ? <IconSpinner className="animate-spin" /> : <IconUpload />}
							{sending ? "Import en cours…" : "Importer"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** What the import did, or why it was refused. */
function ImportOutcome({ result }: { result: ImportResult }) {
	const { import: run, skipped, skippedTotal, duplicates } = result;
	if (run.status !== "success") {
		return (
			<div className="grid gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
				<p className="flex items-center gap-2 font-medium">
					<IconWarning className="size-4" /> Import refusé
				</p>
				<p>{run.error}</p>
			</div>
		);
	}
	const lines: [string, number, string?][] = [
		["Médicaments lus", run.rowsRead],
		["Ajoutés", run.rowsInserted, "text-emerald-700"],
		["Modifiés", run.rowsUpdated],
		["Retirés de la liste (absents du fichier)", run.rowsDeactivated, run.rowsDeactivated ? "text-amber-700" : undefined],
	];
	return (
		<div className="grid gap-3">
			<p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
				<IconCheck className="size-4" /> Import réussi
			</p>
			<dl className="grid gap-1.5 rounded-lg border p-3 text-sm">
				{lines.map(([label, value, tone]) => (
					<div key={label} className="flex justify-between gap-3">
						<dt className="text-muted-foreground">{label}</dt>
						<dd className={cn("font-medium tabular-nums", tone)}>{value.toLocaleString("fr-MA")}</dd>
					</div>
				))}
			</dl>
			{(skippedTotal > 0 || duplicates > 0) && (
				<div className="grid gap-1 text-xs text-muted-foreground">
					{duplicates > 0 && <p>{duplicates} ligne(s) répétant un ID AMMPS déjà lu : la première a été gardée.</p>}
					{skippedTotal > 0 && (
						<>
							<p>{skippedTotal} ligne(s) ignorée(s) :</p>
							<ul className="max-h-32 overflow-y-auto rounded-md bg-muted/60 px-2 py-1">
								{skipped.map((s) => (
									<li key={s.line}>
										Ligne {s.line} : {s.reason}
									</li>
								))}
								{skippedTotal > skipped.length && <li>…</li>}
							</ul>
						</>
					)}
				</div>
			)}
		</div>
	);
}
