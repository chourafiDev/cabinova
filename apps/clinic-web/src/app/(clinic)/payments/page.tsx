import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiBanknotes } from "react-icons/hi2";
import {
	LuChevronLeft,
	LuChevronRight,
	LuCircleCheck,
	LuClock,
	LuPrinter,
	LuUndo2,
	LuWallet,
	LuTriangleAlert,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatFileNumber } from "@/lib/patients";
import { type CashClose, HISTORY_PRESETS, type History, type HistoryPreset, mad, METHOD_LABELS } from "@/lib/payments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { KpiCard } from "../_components/kpi-card";
import { ChartCard } from "../_components/dashboard/chart-card";
import { Bars } from "../reports/_components/bars";
import { CashDesk } from "./_components/cash-desk";
import { HistoryFilters } from "./_components/history-filters";

export const metadata: Metadata = { title: "Encaissements" };

const VIEWS = [
	{ key: "caisse", label: "Caisse du jour" },
	{ key: "historique", label: "Historique" },
	{ key: "clotures", label: "Clôtures" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const periodOf = (preset: HistoryPreset) => {
	const to = today();
	const from =
		preset === "jour" ? to : preset === "7j" ? addDays(to, -6) : preset === "mois" ? `${to.slice(0, 8)}01` : addDays(to, -29);
	return { from, to };
};
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const dateTime = (iso: string) => formatDate(iso, { month: "short", year: undefined, hour: "2-digit", minute: "2-digit" });

/**
 * Encaissements. Everyone: the day's desk (visits to check out, unpaid,
 * the cash close). The responsible doctor also: the history with totals,
 * and the closes with their differences.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
	const state = await getClinicState();
	if (state.status !== "signed-in") notFound();
	const { user, spaces } = state.session;
	const owner = user.role === "owner";
	const params = await searchParams;
	const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
	const view: View = owner ? (VIEWS.find((v) => v.key === one(params.vue))?.key ?? "caisse") : "caisse";
	const preset = HISTORY_PRESETS.find((p) => p.key === one(params.periode))?.key ?? (view === "clotures" ? "30j" : "jour");
	const space = one(params.espace) ?? null;
	const method = one(params.mode) ?? null;
	const page = Math.max(1, Number(one(params.page)) || 1);

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<HiBanknotes className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">Encaissements</h1>
						<p className="text-muted-foreground text-sm">
							{view === "caisse"
								? "Encaissez les visites et clôturez la caisse en fin de journée"
								: view === "historique"
									? "Tous les paiements, remboursements et annulations"
									: "Les clôtures de caisse et leurs écarts"}
						</p>
					</div>
				</div>
			</header>

			{owner && (
				<nav className="bg-muted flex w-fit rounded-lg p-0.5 text-sm" aria-label="Vues">
					{VIEWS.map((v) => (
						<Link
							key={v.key}
							href={v.key === "caisse" ? "/payments" : `/payments?vue=${v.key}`}
							aria-current={view === v.key ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 transition-colors",
								view === v.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{v.label}
						</Link>
					))}
				</nav>
			)}

			{view === "caisse" && (
				<CashDesk spaceName={spaces ? spaceLabel(spaces.current) : null} />
			)}
			{view !== "caisse" && (
				<HistoryFilters view={view} preset={preset} space={space} method={method} spaces={spaces?.spaces ?? []} />
			)}
			{view === "historique" && <HistoryView preset={preset} space={space} method={method} page={page} multiSpace={(spaces?.spaces.length ?? 0) > 1} />}
			{view === "clotures" && <ClosesView preset={preset} space={space} />}
		</div>
	);
}

async function HistoryView({
	preset,
	space,
	method,
	page,
	multiSpace,
}: {
	preset: HistoryPreset;
	space: string | null;
	method: string | null;
	page: number;
	multiSpace: boolean;
}) {
	const query = new URLSearchParams({ ...periodOf(preset), page: String(page) });
	if (space) query.set("space", space);
	if (method) query.set("method", method);
	const h = await apiGet<History>(`/payments?${query}`);
	const pageHref = (p: number) => {
		const next = new URLSearchParams({ vue: "historique", periode: preset, page: String(p) });
		if (space) next.set("espace", space);
		if (method) next.set("mode", method);
		return `/payments?${next}`;
	};
	const label = HISTORY_PRESETS.find((p) => p.key === preset)!.label.toLowerCase();

	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard icon={LuWallet} title="Encaissé" value={mad(h.totals.net)} period={label} hint="Paiements reçus moins les remboursements, hors paiements annulés." />
				<KpiCard icon={LuCircleCheck} title="Paiements" value={h.totals.payments} period={label} hint="Nombre de paiements reçus (hors annulés)." />
				<KpiCard icon={LuUndo2} title="Remboursé" value={mad(h.totals.refunded)} period={label} hint="Argent rendu aux patients sur la période." />
				<KpiCard
					icon={LuClock}
					title="Reste à encaisser"
					value={mad(h.outstanding.amount)}
					period={plural(h.outstanding.visits, "visite", "visites")}
					hint="Tout ce que les patients doivent encore, toutes dates confondues."
				/>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-3">
				<ChartCard title="Par mode de paiement" eyebrow="Encaissements">
					<Bars rows={h.totals.byMethod.map((m) => ({ key: m.method, label: METHOD_LABELS[m.method], value: m.net }))} format={mad} empty="Aucun paiement sur la période." />
				</ChartCard>

				<section className="bg-card overflow-hidden rounded-xl border lg:col-span-2">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h2 className="text-sm font-semibold">Mouvements</h2>
						{h.totals.cancelled > 0 && (
							<span className="text-muted-foreground text-xs">{plural(h.totals.cancelled, "annulation", "annulations")}</span>
						)}
					</div>
					{h.payments.length === 0 ? (
						<p className="text-muted-foreground px-4 py-12 text-center text-sm">Aucun mouvement sur la période.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Patient</TableHead>
									<TableHead className="hidden md:table-cell">Mode</TableHead>
									<TableHead className="text-end">Montant</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{h.payments.map((p) => (
									<TableRow key={p.id} className={cn(p.cancelledAt && "text-muted-foreground")}>
										<TableCell className="whitespace-nowrap tabular-nums">
											{dateTime(p.receivedAt)}
											<div className="text-muted-foreground text-xs">
												{p.receivedBy}
												{multiSpace && ` · ${p.space}`}
											</div>
										</TableCell>
										<TableCell>
											<div className="font-medium">
												{p.patient.firstName} {p.patient.lastName}
											</div>
											<div className="text-muted-foreground text-xs tabular-nums">{formatFileNumber(p.patient.fileNumber)}</div>
										</TableCell>
										<TableCell className="hidden md:table-cell">
											{p.kind === "refund" ? (
												<span>
													Remboursement <span className="text-muted-foreground">({METHOD_LABELS[p.method].toLowerCase()})</span>
												</span>
											) : (
												METHOD_LABELS[p.method]
											)}
											{(p.cancelledAt || p.reason) && (
												<div className="text-muted-foreground max-w-56 truncate text-xs" title={p.cancelReason ?? p.reason ?? undefined}>
													{p.cancelledAt ? `Annulé : ${p.cancelReason}` : p.reason}
												</div>
											)}
										</TableCell>
										<TableCell className="text-end whitespace-nowrap tabular-nums">
											<span className={cn("font-medium", p.cancelledAt && "line-through")}>
												{p.kind === "refund" ? "−" : ""}
												{mad(p.amount)}
											</span>
											{p.cancelledAt ? (
												<div>
													<Badge variant="outline" className="font-normal">
														Annulé
													</Badge>
												</div>
											) : (
												p.receiptNumber && (
													<a
														href={`/receipts/${p.id}`}
														target="_blank"
														rel="noopener"
														title="Imprimer le reçu"
														className="text-muted-foreground hover:text-foreground flex items-center justify-end gap-1 font-mono text-[11px]"
													>
														<LuPrinter className="size-3" /> {p.receiptNumber}
													</a>
												)
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
					{h.pageCount > 1 && (
						<div className="flex items-center justify-between border-t px-4 py-2 text-sm">
							<span className="text-muted-foreground">
								Page {h.page} sur {h.pageCount}
							</span>
							<span className="flex gap-1">
								<Button asChild variant="outline" size="icon" className="size-8" aria-disabled={h.page <= 1}>
									<Link href={pageHref(Math.max(1, h.page - 1))} aria-label="Page précédente" scroll={false}>
										<LuChevronLeft />
									</Link>
								</Button>
								<Button asChild variant="outline" size="icon" className="size-8" aria-disabled={h.page >= h.pageCount}>
									<Link href={pageHref(Math.min(h.pageCount, h.page + 1))} aria-label="Page suivante" scroll={false}>
										<LuChevronRight />
									</Link>
								</Button>
							</span>
						</div>
					)}
				</section>
			</div>
		</>
	);
}

async function ClosesView({ preset, space }: { preset: HistoryPreset; space: string | null }) {
	const query = new URLSearchParams(periodOf(preset));
	if (space) query.set("space", space);
	const closes = await apiGet<CashClose[]>(`/cashier/closes?${query}`);

	return (
		<section className="bg-card overflow-hidden rounded-xl border">
			{closes.length === 0 ? (
				<p className="text-muted-foreground px-4 py-12 text-center text-sm">Aucune clôture sur la période.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Jour</TableHead>
							<TableHead className="hidden md:table-cell">Clôturée par</TableHead>
							<TableHead className="text-end">Espèces attendues</TableHead>
							<TableHead className="text-end">Comptées</TableHead>
							<TableHead className="text-end">Écart</TableHead>
							<TableHead className="hidden text-end xl:table-cell">Carte · chèque · virement</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{closes.map((c) => (
							<TableRow key={c.id}>
								<TableCell>
									<div className="font-medium first-letter:uppercase">
										{formatDate(`${c.day}T12:00:00`, { weekday: "short", month: "short", year: undefined })}
									</div>
									<div className="text-muted-foreground text-xs">{c.space}</div>
								</TableCell>
								<TableCell className="text-muted-foreground hidden md:table-cell">
									{c.closedBy ?? "—"} · {formatDate(c.closedAt, { day: undefined, month: undefined, year: undefined, hour: "2-digit", minute: "2-digit" })}
									{c.note && <div className="max-w-64 truncate text-xs" title={c.note}>{c.note}</div>}
								</TableCell>
								<TableCell className="text-end tabular-nums">{mad(c.expected.cash)}</TableCell>
								<TableCell className="text-end tabular-nums">{mad(c.countedCash)}</TableCell>
								<TableCell className="text-end">
									<span
										className={cn(
											"inline-flex items-center gap-1 font-medium tabular-nums",
											c.difference === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
										)}
									>
										{c.difference === 0 ? <LuCircleCheck className="size-3.5" /> : <LuTriangleAlert className="size-3.5" />}
										{c.difference === 0 ? "Juste" : `${c.difference > 0 ? "+" : ""}${mad(c.difference)}`}
									</span>
								</TableCell>
								<TableCell className="text-muted-foreground hidden text-end tabular-nums xl:table-cell">
									{mad(c.expected.card)} · {mad(c.expected.cheque)} · {mad(c.expected.transfer)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</section>
	);
}
