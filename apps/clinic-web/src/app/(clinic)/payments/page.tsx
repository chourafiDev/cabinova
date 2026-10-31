import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
import { pageTitle } from "@/i18n/titles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFormat } from "@/lib/get-format";
import { formatFileNumber } from "@/lib/patients";
import { type CashClose, HISTORY_PRESETS, type History, type HistoryPreset } from "@/lib/payments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { KpiCard } from "../_components/kpi-card";
import { ChartCard } from "../_components/dashboard/chart-card";
import { Bars } from "../reports/_components/bars";
import { CashDesk } from "./_components/cash-desk";
import { HistoryFilters } from "./_components/history-filters";

export const generateMetadata = () => pageTitle("payments");

const VIEWS = ["caisse", "historique", "clotures"] as const;
type View = (typeof VIEWS)[number];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const periodOf = (preset: HistoryPreset) => {
	const to = today();
	const from =
		preset === "jour" ? to : preset === "7j" ? addDays(to, -6) : preset === "mois" ? `${to.slice(0, 8)}01` : addDays(to, -29);
	return { from, to };
};

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
	const view: View = owner ? (VIEWS.find((v) => v === one(params.vue)) ?? "caisse") : "caisse";
	const preset = HISTORY_PRESETS.find((p) => p.key === one(params.periode))?.key ?? (view === "clotures" ? "30j" : "jour");
	const space = one(params.espace) ?? null;
	const method = one(params.mode) ?? null;
	const page = Math.max(1, Number(one(params.page)) || 1);
	const t = await getTranslations("payments");

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<HiBanknotes className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">{t("title")}</h1>
						<p className="text-muted-foreground text-sm">{t(`subtitle.${view}`)}</p>
					</div>
				</div>
			</header>

			{owner && (
				<nav className="bg-muted flex w-fit rounded-lg p-0.5 text-sm" aria-label={t("views.label")}>
					{VIEWS.map((v) => (
						<Link
							key={v}
							href={v === "caisse" ? "/payments" : `/payments?vue=${v}`}
							aria-current={view === v ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 transition-colors",
								view === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{t(`views.${v}`)}
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
	const t = await getTranslations("payments");
	const common = await getTranslations("common");
	const format = await getFormat();
	const { mad } = format;
	const label = t(`presets.${preset}`).toLowerCase();
	const dateTime = (iso: string) => format.date(iso, { month: "short", year: undefined, hour: "2-digit", minute: "2-digit" });

	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard icon={LuWallet} title={t("history.received")} value={mad(h.totals.net)} period={label} hint={t("history.receivedHint")} />
				<KpiCard icon={LuCircleCheck} title={t("history.payments")} value={h.totals.payments} period={label} hint={t("history.paymentsHint")} />
				<KpiCard icon={LuUndo2} title={t("history.refunded")} value={mad(h.totals.refunded)} period={label} hint={t("history.refundedHint")} />
				<KpiCard
					icon={LuClock}
					title={t("history.outstanding")}
					value={mad(h.outstanding.amount)}
					period={t("history.visits", { count: h.outstanding.visits })}
					hint={t("history.outstandingHint")}
				/>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-3">
				<ChartCard title={t("history.byMethod")} eyebrow={t("title")}>
					<Bars rows={h.totals.byMethod.map((m) => ({ key: m.method, label: t(`methods.${m.method}`), value: m.net }))} format={mad} empty={t("history.noPayments")} />
				</ChartCard>

				<section className="bg-card overflow-hidden rounded-xl border lg:col-span-2">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h2 className="text-sm font-semibold">{t("history.movements")}</h2>
						{h.totals.cancelled > 0 && (
							<span className="text-muted-foreground text-xs">{t("history.cancellations", { count: h.totals.cancelled })}</span>
						)}
					</div>
					{h.payments.length === 0 ? (
						<p className="text-muted-foreground px-4 py-12 text-center text-sm">{t("history.noMovements")}</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("history.date")}</TableHead>
									<TableHead>{t("history.patient")}</TableHead>
									<TableHead className="hidden md:table-cell">{t("history.mode")}</TableHead>
									<TableHead className="text-end">{t("history.amount")}</TableHead>
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
													{t("history.refund")} <span className="text-muted-foreground">({t(`methods.${p.method}`).toLowerCase()})</span>
												</span>
											) : (
												t(`methods.${p.method}`)
											)}
											{(p.cancelledAt || p.reason) && (
												<div className="text-muted-foreground max-w-56 truncate text-xs" title={p.cancelReason ?? p.reason ?? undefined}>
													{p.cancelledAt ? t("history.cancelledBecause", { reason: p.cancelReason ?? "" }) : p.reason}
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
														{t("history.cancelled")}
													</Badge>
												</div>
											) : (
												p.receiptNumber && (
													<a
														href={`/receipts/${p.id}`}
														target="_blank"
														rel="noopener"
														title={t("history.printReceipt")}
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
								{common("pagination.page", { page: h.page, total: h.pageCount })}
							</span>
							<span className="flex gap-1">
								<Button asChild variant="outline" size="icon" className="size-8" aria-disabled={h.page <= 1}>
									<Link href={pageHref(Math.max(1, h.page - 1))} aria-label={t("history.previousPage")} scroll={false}>
										<LuChevronLeft className="rtl:rotate-180" />
									</Link>
								</Button>
								<Button asChild variant="outline" size="icon" className="size-8" aria-disabled={h.page >= h.pageCount}>
									<Link href={pageHref(Math.min(h.pageCount, h.page + 1))} aria-label={t("history.nextPage")} scroll={false}>
										<LuChevronRight className="rtl:rotate-180" />
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
	const t = await getTranslations("payments.closes");
	const format = await getFormat();
	const { mad } = format;

	return (
		<section className="bg-card overflow-hidden rounded-xl border">
			{closes.length === 0 ? (
				<p className="text-muted-foreground px-4 py-12 text-center text-sm">{t("none")}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("day")}</TableHead>
							<TableHead className="hidden md:table-cell">{t("closedBy")}</TableHead>
							<TableHead className="text-end">{t("expected")}</TableHead>
							<TableHead className="text-end">{t("counted")}</TableHead>
							<TableHead className="text-end">{t("difference")}</TableHead>
							<TableHead className="hidden text-end xl:table-cell">{t("others")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{closes.map((c) => (
							<TableRow key={c.id}>
								<TableCell>
									<div className="font-medium first-letter:uppercase">
										{format.date(`${c.day}T12:00:00`, { weekday: "short", month: "short", year: undefined })}
									</div>
									<div className="text-muted-foreground text-xs">{c.space}</div>
								</TableCell>
								<TableCell className="text-muted-foreground hidden md:table-cell">
									{c.closedBy ?? "—"} · {format.date(c.closedAt, { day: undefined, month: undefined, year: undefined, hour: "2-digit", minute: "2-digit" })}
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
										{c.difference === 0 ? t("exact") : `${c.difference > 0 ? "+" : ""}${mad(c.difference)}`}
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
