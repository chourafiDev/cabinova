"use client";

import { Check, Copy, Download, FileArchive, Loader, Lock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { api, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { formatBytes, type TenantDataStatus } from "@/lib/security";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";

const day = (iso: string) => formatDate(iso, { month: "long" });

/** Copies a fingerprint, shows a short form of it. */
function Fingerprint({ sha }: { sha: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			title={sha}
			onClick={async () => {
				await navigator.clipboard.writeText(sha);
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			}}
			className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted/70"
		>
			{sha.slice(0, 16)}…{copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
		</button>
	);
}

/**
 * Données (Scenario D): export the clinic's data at any time (fingerprint
 * kept as proof); delete the database only once the cabinet is closed, the
 * retention period is over and an export was made after closure.
 */
export function TenantDataTab({ tenantId, tenantName, data }: { tenantId: string; tenantName: string; data: TenantDataStatus }) {
	const router = useRouter();
	const [exporting, setExporting] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmName, setConfirmName] = useState("");
	const [deleting, setDeleting] = useState(false);
	const deleted = !!data.database?.deletedAt;

	const exportData = async () => {
		setExporting(true);
		try {
			const res = await fetch(`/api/tenants/${tenantId}/data/export`, { method: "POST" });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new ApiError(res.status, body?.code, body?.message ?? res.statusText);
			}
			const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.json.gz";
			const href = URL.createObjectURL(await res.blob());
			const a = Object.assign(document.createElement("a"), { href, download: filename });
			a.click();
			URL.revokeObjectURL(href);
			toast.success("Export téléchargé", { description: `Empreinte ${res.headers.get("X-Export-Sha256")?.slice(0, 16)}… enregistrée.` });
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Export impossible");
		} finally {
			setExporting(false);
		}
	};

	const deleteData = async () => {
		setDeleting(true);
		try {
			await api(`/tenants/${tenantId}/data/delete`, { method: "POST", body: JSON.stringify({ confirmName }) });
			toast.success("Base du cabinet supprimée définitivement");
			setConfirmOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Suppression impossible");
		} finally {
			setDeleting(false);
		}
	};

	const steps = [
		{ label: "Cabinet fermé", done: !!data.closedAt, detail: data.closedAt ? `le ${day(data.closedAt)}` : "pas encore" },
		{
			label: `Conservation de ${data.retentionYears} ans écoulée`,
			done: !!data.retentionEndsAt && new Date(data.retentionEndsAt) <= new Date(),
			detail: data.retentionEndsAt ? `jusqu’au ${day(data.retentionEndsAt)}` : "commence à la fermeture",
		},
		{
			label: "Export après la fermeture",
			done: !!data.closedAt && data.exports.some((e) => e.createdAt >= data.closedAt!),
			detail: "preuve conservée",
		},
	];

	return (
		<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
			<FormCard
				title="Exports des données"
				action={
					data.canExport && (
						<Button size="sm" onClick={exportData} disabled={exporting}>
							{exporting ? <Loader className="animate-spin" /> : <Download />} Exporter
						</Button>
					)
				}
			>
				<p className="mb-3 text-sm text-muted-foreground">
					Toutes les tables de la base du cabinet, en JSON compressé. Mots de passe et jetons sont exclus. L’empreinte
					SHA-256 de chaque fichier est conservée : elle prouve ce qui a été remis.
				</p>
				{data.exports.length === 0 ? (
					<p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">Aucun export pour l’instant.</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{data.exports.map((e) => (
							<li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
								<FileArchive className="size-4 text-muted-foreground" />
								<span className="grid leading-tight">
									<span>{formatDate(e.createdAt, { month: "short", hour: "2-digit", minute: "2-digit" })}</span>
									<span className="text-xs text-muted-foreground">
										{e.requestedBy ?? "—"} · {formatBytes(e.sizeBytes)} ·{" "}
										{Object.values(e.tables).reduce((a, b) => a + b, 0)} lignes
									</span>
								</span>
								<span className="ms-auto">
									<Fingerprint sha={e.sha256} />
								</span>
							</li>
						))}
					</ul>
				)}
			</FormCard>

			<FormCard title="Suppression définitive">
				{deleted ? (
					<div className="grid gap-1 text-sm">
						<Badge variant="outline" className="w-fit border-transparent bg-zinc-100 text-zinc-700">
							<Lock /> Base supprimée
						</Badge>
						<p className="text-muted-foreground">
							Le {day(data.database!.deletedAt!)}. Le cabinet, ses factures et la preuve d’export restent au journal.
						</p>
					</div>
				) : (
					<div className="grid gap-3 text-sm">
						<ol className="grid gap-2">
							{steps.map((s) => (
								<li key={s.label} className="flex items-start gap-2">
									<span
										className={cn(
											"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
											s.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40",
										)}
									>
										{s.done && <Check className="size-3" />}
									</span>
									<span className="grid leading-tight">
										<span className={cn(!s.done && "text-muted-foreground")}>{s.label}</span>
										<span className="text-xs text-muted-foreground">{s.detail}</span>
									</span>
								</li>
							))}
						</ol>
						<Button variant="destructive" size="sm" className="w-fit" disabled={!data.canDelete} onClick={() => setConfirmOpen(true)}>
							<Trash2 /> Supprimer la base
						</Button>
						{!data.canDelete && <p className="text-xs text-muted-foreground">Jamais automatique : disponible quand les trois conditions sont remplies.</p>}
					</div>
				)}
			</FormCard>

			<Dialog open={confirmOpen} onOpenChange={(o) => (setConfirmOpen(o), setConfirmName(""))}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Supprimer définitivement les données ?</DialogTitle>
						<DialogDescription>
							La base de « {tenantName} » sera détruite : patients, rendez-vous, dossiers. C’est irréversible. Le dernier
							export reste votre seule copie.
						</DialogDescription>
					</DialogHeader>
					<label className="grid gap-1.5 text-sm">
						Tapez <strong>{tenantName}</strong> pour confirmer
						<Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
					</label>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmOpen(false)}>
							Annuler
						</Button>
						<Button variant="destructive" disabled={confirmName.trim() !== tenantName || deleting} onClick={deleteData}>
							{deleting && <Loader className="animate-spin" />} Supprimer définitivement
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
