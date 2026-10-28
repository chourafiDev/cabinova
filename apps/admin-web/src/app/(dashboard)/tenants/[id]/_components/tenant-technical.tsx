"use client";

import { CircleCheck, CircleDashed, CircleX, Loader, MinusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { formatStorage } from "@/lib/plans";
import { formatBytes, PROVISIONING_STEPS, type ProvisioningRun, type TenantDatabaseInfo } from "@/lib/tenant-databases";
import type { TenantStatus } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";

const dateTime = (value: string | null) =>
	value ? formatDate(value, { month: "short", hour: "2-digit", minute: "2-digit" }) : null;

/**
 * Module 4 on the cabinet page: provision a pending cabinet, follow the run
 * step by step, then test the connection or apply migrations.
 */
export function TenantTechnical({
	tenantId,
	status,
	info,
	canWrite,
	storageQuotaMb,
}: {
	tenantId: string;
	status: TenantStatus;
	info: TenantDatabaseInfo;
	canWrite: boolean;
	/** The cabinet's storage quota (NULL = unlimited). */
	storageQuotaMb: number | null;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [sendInvitation, setSendInvitation] = useState(true);
	const latestRun = info.runs[0];
	const running = latestRun?.state === "running";
	const db = info.database;

	// Follow a running provisioning until it finishes.
	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => router.refresh(), 2000);
		return () => clearInterval(timer);
	}, [running, router]);

	const act = (path: string, body: unknown, done: (result: never) => string) =>
		startTransition(async () => {
			try {
				const result = await api<never>(path, { method: "POST", body: JSON.stringify(body) });
				toast.success(done(result));
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Action impossible");
			}
		});

	const row = (label: string, value: React.ReactNode) => (
		<div className="grid grid-cols-[160px_1fr] gap-4 py-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{value ?? <span className="text-muted-foreground">—</span>}</dd>
		</div>
	);

	const upToDate = db?.schemaVersion === info.latestSchemaVersion;

	return (
		<div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:items-start">
			<div className="grid gap-3">
				{!db && status === "pending" && canWrite && !running && (
					<FormCard title="Provisionner le cabinet">
						<div className="grid gap-3 text-sm">
							<p className="text-muted-foreground">
								Crée la base de données du cabinet et son rôle, applique le schéma, crée le compte du médecin
								responsable, teste la connexion, puis passe le cabinet à « Actif ».
							</p>
							{!info.configured && (
								<p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
									Provisionnement indisponible : TENANT_SECRETS_KEY et TENANT_DB_ADMIN_URL ne sont pas définies
									sur l’API.
								</p>
							)}
							<Field orientation="horizontal">
								<Checkbox
									id="sendInvitation"
									checked={sendInvitation}
									onCheckedChange={(v) => setSendInvitation(v === true)}
								/>
								<FieldLabel htmlFor="sendInvitation" className="font-normal">
									Envoyer l’invitation au médecin responsable
								</FieldLabel>
							</Field>
							<div>
								<Button
									disabled={pending || !info.configured}
									onClick={() =>
										act(`/tenants/${tenantId}/provision`, { sendInvitation }, () => "Provisionnement lancé")
									}
								>
									{pending && <Loader className="animate-spin" />} Provisionner
								</Button>
							</div>
						</div>
					</FormCard>
				)}

				{db && (
					<FormCard
						title="Base de données"
						action={
							canWrite && (
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										disabled={pending}
										onClick={() =>
											act(`/tenants/${tenantId}/database/check`, {}, (r: { healthy: boolean; latencyMs: number }) =>
												r.healthy ? `Connexion OK (${r.latencyMs} ms)` : "Base injoignable",
											)
										}
									>
										Tester la connexion
									</Button>
									<Button
										size="sm"
										variant="outline"
										disabled={pending}
										onClick={() =>
											act(`/tenants/${tenantId}/database/migrate`, {}, (r: { ok: boolean; schemaVersion?: string }) =>
												r.ok ? `Schéma ${r.schemaVersion}` : "Migration échouée",
											)
										}
									>
										Migrer
									</Button>
									<Button
										size="sm"
										variant="outline"
										disabled={pending}
										onClick={() =>
											act(
												`/tenants/${tenantId}/database/invitation`,
												{},
												(r: { email: string }) => `Invitation envoyée à ${r.email}`,
											)
										}
									>
										Renvoyer l’invitation
									</Button>
								</div>
							)
						}
					>
						<dl className="divide-y">
							{row(
								"Connexion",
								db.healthy === null ? (
									"Jamais testée"
								) : (
									<span className="flex flex-wrap items-center gap-2">
										<Badge
											variant="outline"
											className={cn(
												"border-transparent",
												db.healthy ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
											)}
										>
											{db.healthy ? "Joignable" : "Injoignable"}
										</Badge>
										{db.latencyMs !== null && <span className="text-xs text-muted-foreground">{db.latencyMs} ms</span>}
										<span className="text-xs text-muted-foreground">{dateTime(db.lastHealthCheckAt)}</span>
									</span>
								),
							)}
							{db.lastHealthError && row("Erreur", <span className="text-destructive">{db.lastHealthError}</span>)}
							{row(
								"Stockage",
								db.sizeBytes === null ? (
									"Mesuré au prochain test de connexion"
								) : (
									<StorageMeter bytes={db.sizeBytes} quotaMb={storageQuotaMb} />
								),
							)}
							{row(
								"Schéma",
								<span className="flex flex-wrap items-center gap-2">
									<code className="text-xs">{db.schemaVersion ?? "aucun"}</code>
									<Badge
										variant="outline"
										className={cn(
											"border-transparent",
											upToDate ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
										)}
									>
										{upToDate ? "À jour" : `En retard (${info.latestSchemaVersion})`}
									</Badge>
								</span>,
							)}
							{row("Dernière migration", dateTime(db.lastMigratedAt))}
							{db.lastMigrationError &&
								row("Migration échouée", <span className="text-destructive">{db.lastMigrationError}</span>)}
							{row("Base", <code className="text-xs">{db.databaseName}</code>)}
							{row("Rôle", <code className="text-xs">{db.roleName}</code>)}
							{row("Hôte", <code className="text-xs">{db.host}</code>)}
							{row("Hébergement", `${db.provider} · une base par cabinet`)}
							{row("Identifiants", "Chiffrés (AES-256-GCM) dans le catalogue")}
						</dl>
					</FormCard>
				)}

				{!db && status !== "pending" && !running && (
					<FormCard>
						<p className="py-4 text-center text-sm text-muted-foreground">
							Aucune base pour ce cabinet. Seul un cabinet « En attente » peut être provisionné.
						</p>
					</FormCard>
				)}
			</div>

			<div className="grid gap-3">
				{latestRun ? (
					<RunTimeline run={latestRun} />
				) : (
					<FormCard title="Provisionnement">
						<p className="py-2 text-sm text-muted-foreground">Jamais lancé.</p>
					</FormCard>
				)}
			</div>
		</div>
	);
}

function RunTimeline({ run }: { run: ProvisioningRun }) {
	const done = new Map(run.steps.map((s) => [s.key, s]));
	const stateLabel = { running: "En cours", succeeded: "Terminé", failed: "Échec" }[run.state];

	return (
		<FormCard
			title="Dernier provisionnement"
			action={
				<Badge
					variant="outline"
					className={cn(
						"border-transparent",
						run.state === "succeeded" && "bg-emerald-50 text-emerald-700",
						run.state === "failed" && "bg-red-50 text-red-700",
						run.state === "running" && "bg-sky-50 text-sky-700",
					)}
				>
					{stateLabel}
				</Badge>
			}
		>
			<ol className="grid gap-2.5 text-sm">
				{Object.entries(PROVISIONING_STEPS).map(([key, label], index) => {
					const step = done.get(key);
					const isCurrent = run.state === "running" && !step && index === run.steps.length;
					const Icon = !step
						? isCurrent
							? Loader
							: CircleDashed
						: step.status === "done"
							? CircleCheck
							: step.status === "skipped"
								? MinusCircle
								: CircleX;
					return (
						<li key={key} className="flex gap-2">
							<Icon
								className={cn(
									"mt-0.5 size-4 shrink-0",
									!step && "text-muted-foreground/50",
									isCurrent && "animate-spin text-sky-600",
									step?.status === "done" && "text-emerald-600",
									step?.status === "skipped" && "text-muted-foreground",
									step?.status === "failed" && "text-destructive",
								)}
							/>
							<div className="grid min-w-0">
								<span className={cn(!step && !isCurrent && "text-muted-foreground")}>
									{label}
									{step?.status === "skipped" && <span className="text-muted-foreground"> (ignorée)</span>}
								</span>
								{step?.detail && (
									<span
										className={cn(
											"break-words text-xs",
											step.status === "failed" ? "text-destructive" : "text-muted-foreground",
										)}
									>
										{step.detail}
									</span>
								)}
							</div>
						</li>
					);
				})}
			</ol>
			<p className="mt-3 text-xs text-muted-foreground">
				Lancé le {dateTime(run.startedAt)}
				{run.finishedAt && ` · ${Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000)} s`}
			</p>
			{run.state === "failed" && (
				<p className="mt-2 text-xs text-muted-foreground">
					Le cabinet est revenu « En attente » : relancez le provisionnement, les étapes déjà faites sont reprises.
				</p>
			)}
		</FormCard>
	);
}

/** Database size against the quota; amber from 75 %, red from 90 %. Files (uploads) will add to it later. */
function StorageMeter({ bytes, quotaMb }: { bytes: number; quotaMb: number | null }) {
	const ratio = quotaMb ? bytes / (quotaMb * 1024 * 1024) : null;
	return (
		<span className="grid max-w-xs gap-1">
			<span className="text-xs">
				<span className="font-medium tabular-nums">{formatBytes(bytes)}</span>
				<span className="text-muted-foreground">
					{" "}
					/ {formatStorage(quotaMb)}
					{ratio !== null && ` · ${Math.round(ratio * 100)} %`}
				</span>
			</span>
			{ratio !== null && (
				<span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
					<span
						className={cn(
							"block h-full rounded-full",
							ratio >= 0.9 ? "bg-red-600" : ratio >= 0.75 ? "bg-amber-500" : "bg-emerald-600",
						)}
						style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }}
					/>
				</span>
			)}
			<span className="text-[11px] text-muted-foreground">Base de données seule ; les fichiers s’y ajouteront avec l’application des cabinets.</span>
		</span>
	);
}
