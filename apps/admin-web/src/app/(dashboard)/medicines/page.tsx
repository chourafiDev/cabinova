import Link from "next/link";
import { notFound } from "next/navigation";
import {
	IconChevronLeft,
	IconChevronRight,
	IconInfo,
	IconPill,
	IconShieldCheck,
	IconWarning,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
	AVAILABILITY_LABELS,
	AVAILABILITY_TONES,
	formatPrice,
	type MedicationImport,
	type MedicationsPage,
	type MedicinesOverview,
} from "@/lib/medicines";
import { can } from "@/lib/permissions";
import { plural } from "@/lib/plural";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { KpiCard } from "../_components/shared/kpi-card";
import { ImportDialog } from "./_components/import-dialog";
import { MedicinesFilters } from "./_components/medicines-filters";

export const metadata = { title: "Médicaments" };

const FILTERS = ["marketed", "not_marketed", "withdrawn", "inactive"] as const;
const dateTime = (d: string) => formatDate(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Médicaments: the national AMMPS list every cabinet's ordonnance picks
 * from, kept in one shared database. The Super Admin imports the AMMPS
 * export (.xlsx); the page shows where the list stands, its imports, and
 * the list itself.
 */
export default async function MedicinesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "medicines:read")) notFound();
	const canImport = can(session.user.permissions, "medicines:write");
	const params = await searchParams;
	const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
	const q = get("q")?.trim() ?? "";
	const availability = FILTERS.find((f) => f === get("disponibilite"));
	const page = Math.max(1, Number(get("page")) || 1);

	const overview = await apiGet<MedicinesOverview>("/medicines/overview");

	const header = (
		<div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-foreground/20 pb-4">
			<span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
				<IconPill className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 leading-tight">
				<h1 className="font-semibold">Médicaments</h1>
				<span className="text-xs text-muted-foreground">
					Liste nationale de l’AMMPS, partagée par tous les cabinets pour leurs ordonnances.
				</span>
			</div>
			{canImport && overview.configured && <ImportDialog busy={!!overview.running} />}
		</div>
	);

	if (!overview.configured) {
		return (
			<>
				{header}
				<FormCard title="Base des médicaments non configurée">
					<div className="grid gap-2 text-sm text-muted-foreground">
						<p>
							Ajoutez <code className="text-foreground">MEDICINES_DATABASE_URL</code> (l’URL propriétaire d’une base Neon
							dédiée) dans l’environnement d’admin-api, puis redémarrez-le : les tables sont créées au démarrage.
						</p>
						<p>Vous pourrez ensuite importer l’export AMMPS (.xlsx) depuis cette page.</p>
					</div>
				</FormCard>
			</>
		);
	}

	const query = new URLSearchParams({
		page: String(page),
		...(q && { q }),
		...(availability && { availability }),
	});
	const [imports, list] = await Promise.all([
		apiGet<MedicationImport[]>("/medicines/imports"),
		apiGet<MedicationsPage>(`/medicines?${query}`),
	]);
	const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));
	const pageHref = (p: number) => {
		const next = new URLSearchParams({ ...(q && { q }), ...(availability && { disponibilite: availability }) });
		if (p > 1) next.set("page", String(p));
		const s = next.toString();
		return s ? `/medicines?${s}` : "/medicines";
	};
	const last = overview.lastImport;
	const priceShare = overview.active ? Math.round((overview.withPrice / overview.active) * 100) : 0;

	return (
		<>
			{header}

			{overview.running && (
				<p className="mb-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
					<IconInfo className="size-4 shrink-0" />
					Import en cours : {overview.running.fileName}, lancé le {dateTime(overview.running.startedAt)}
					{overview.running.importedByName && ` par ${overview.running.importedByName}`}.
				</p>
			)}

			<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					icon={IconPill}
					title="Médicaments actifs"
					value={overview.active.toLocaleString("fr-MA")}
					period={`${priceShare} % avec un prix public`}
					hint="Médicaments présents dans le dernier fichier importé. Ceux qui n’y sont plus restent en base, inactifs, pour les anciennes ordonnances."
				/>
				<KpiCard
					icon={IconShieldCheck}
					title="Commercialisés"
					value={overview.byAvailability.marketed.toLocaleString("fr-MA")}
					valueClassName="text-emerald-700"
					period="Proposés en priorité"
					hint="Statuts « Commercialisé », y compris appels d’offres (AO) et export."
				/>
				<KpiCard
					icon={IconInfo}
					title="Non commercialisés"
					value={overview.byAvailability.not_marketed.toLocaleString("fr-MA")}
					period="AMM sans mise sur le marché"
					hint="« Non commercialisé », « AMM sans prix », « En cours de fixation de prix »."
				/>
				<KpiCard
					icon={IconWarning}
					title="Retirés / suspendus"
					value={overview.byAvailability.withdrawn.toLocaleString("fr-MA")}
					valueClassName={overview.byAvailability.withdrawn ? "text-red-700" : undefined}
					period={overview.inactive ? `+ ${plural(overview.inactive, "absent")} du fichier` : "Jamais proposés"}
					hint="Jamais proposés pour une nouvelle ordonnance ; signalés au renouvellement d’une ancienne."
				/>
			</section>

			<p className="mb-3 text-xs text-muted-foreground">
				{last ? (
					<>
						Dernier import réussi : <span className="text-foreground">{last.fileName}</span>, le {dateTime(last.startedAt)}
						{last.importedByName && <> par {last.importedByName}</>}.
					</>
				) : (
					"Aucun import pour l’instant : importez l’export AMMPS (.xlsx) pour remplir la liste."
				)}
			</p>

			<div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<FormCard
					title={`Liste${list.total ? ` · ${list.total.toLocaleString("fr-MA")}` : ""}`}
					contentClassName="p-0"
				>
					<div className="border-b p-3">
						<MedicinesFilters q={q} availability={availability} />
					</div>
					{list.items.length === 0 ? (
						<p className="px-3 py-10 text-center text-sm text-muted-foreground">
							{q || availability ? "Aucun médicament ne correspond." : "La liste est vide."}
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="text-xs text-muted-foreground">
									<tr className="border-b">
										<th className="px-3 py-2 text-start font-medium">Médicament</th>
										<th className="px-3 py-2 text-start font-medium">Substance active</th>
										<th className="hidden px-3 py-2 text-start font-medium lg:table-cell">Présentation</th>
										<th className="px-3 py-2 text-end font-medium">PPV</th>
										<th className="px-3 py-2 text-start font-medium">Statut</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{list.items.map((m) => {
										const tone = m.isActive ? m.availability : "inactive";
										return (
											<tr key={m.ammpsId} className={cn("align-top hover:bg-muted/40", !m.isActive && "text-muted-foreground")}>
												<td className="px-3 py-2">
													<p className="font-medium">
														{m.name}
														{m.dosage && <span className="font-normal text-muted-foreground"> · {m.dosage}</span>}
													</p>
													<p className="text-xs text-muted-foreground">
														{m.form}
														<span className="ms-1.5 tabular-nums opacity-70">#{m.ammpsId}</span>
													</p>
												</td>
												<td className="max-w-64 px-3 py-2 text-xs">{m.substances.split(" // ").join(" + ")}</td>
												<td className="hidden max-w-56 px-3 py-2 text-xs text-muted-foreground lg:table-cell">
													{m.presentation}
													{m.lab && <span className="block opacity-80">{m.lab}</span>}
												</td>
												<td className="px-3 py-2 text-end text-xs whitespace-nowrap tabular-nums">{formatPrice(m.ppv)}</td>
												<td className="px-3 py-2">
													<Badge
														variant="outline"
														className={cn("border-transparent", AVAILABILITY_TONES[tone])}
														title={m.status ?? undefined}
													>
														{AVAILABILITY_LABELS[tone]}
													</Badge>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
					{pageCount > 1 && (
						<div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
							<span>
								Page {page} / {pageCount}
							</span>
							<PageButton href={page > 1 ? pageHref(page - 1) : null} label="Page précédente">
								<IconChevronLeft />
							</PageButton>
							<PageButton href={page < pageCount ? pageHref(page + 1) : null} label="Page suivante">
								<IconChevronRight />
							</PageButton>
						</div>
					)}
				</FormCard>

				<FormCard title="Imports" contentClassName="p-0">
					{imports.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun import.</p>
					) : (
						<ol className="divide-y">
							{imports.map((run) => (
								<li key={run.id} className="grid gap-1 px-3 py-2.5 text-xs">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-sm font-medium" title={run.fileName}>
											{run.fileName}
										</span>
										<ImportStatus status={run.status} />
									</div>
									<span className="text-muted-foreground">
										{dateTime(run.startedAt)}
										{run.importedByName ? ` · ${run.importedByName}` : " · ligne de commande"}
									</span>
									{run.status === "success" && (
										<span className="tabular-nums">
											{run.rowsRead.toLocaleString("fr-MA")} lus · <span className="text-emerald-700">+{run.rowsInserted}</span> ·{" "}
											{run.rowsUpdated} modifiés · <span className={run.rowsDeactivated ? "text-amber-700" : undefined}>{run.rowsDeactivated} retirés de la liste</span>
										</span>
									)}
									{run.error && <span className="text-red-700">{run.error}</span>}
								</li>
							))}
						</ol>
					)}
				</FormCard>
			</div>
		</>
	);
}

function PageButton({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
	return (
		<Button asChild={!!href} size="icon-sm" variant="outline" disabled={!href} aria-label={label}>
			{href ? (
				<Link href={href} scroll={false}>
					{children}
				</Link>
			) : (
				<span>{children}</span>
			)}
		</Button>
	);
}

function ImportStatus({ status }: { status: MedicationImport["status"] }) {
	const { label, tone } = {
		success: { label: "Réussi", tone: "bg-emerald-50 text-emerald-700" },
		failed: { label: "Refusé", tone: "bg-red-50 text-red-700" },
		running: { label: "En cours", tone: "bg-sky-50 text-sky-700" },
	}[status];
	return (
		<Badge variant="outline" className={cn("shrink-0 border-transparent", tone)}>
			{label}
		</Badge>
	);
}
