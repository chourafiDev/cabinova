import Link from "next/link";
import { LuChevronLeft, LuChevronRight, LuPlus, LuUsers } from "react-icons/lu";
import { NoShowBadge } from "@/components/no-show-badge";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/titles";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFormat } from "@/lib/get-format";
import {
	ageOf,
	isMedicalRole,
	formatFileNumber,
	formatPhone,
	fullName,
	type PatientsPage,
} from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { PatientSheet } from "./_components/patient-sheet";
import { PatientsSearch } from "./_components/patients-search";

export const generateMetadata = () => pageTitle("patients");

const PER_PAGE = 20;
const STATUSES = ["active", "archived"] as const;
type Status = (typeof STATUSES)[number];

/** The space's patients: search, active / archived, 20 per page. A patient opens in a sheet over the list. */
export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
	const params = await searchParams;
	const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
	const status: Status = one(params.status) === "archived" ? "archived" : "active";
	const search = one(params.search)?.trim() ?? "";
	const page = Math.max(1, Number(one(params.page)) || 1);

	const query = new URLSearchParams({ status, page: String(page), perPage: String(PER_PAGE) });
	if (search) query.set("search", search);
	const [{ data, total, pageCount }, state] = await Promise.all([
		apiGet<PatientsPage>(`/patients?${query}`),
		getClinicState(),
	]);
	const space = state.status === "signed-in" ? state.session.spaces?.current : undefined;
	const medical = state.status === "signed-in" && isMedicalRole(state.session.user.role);
	const t = await getTranslations("patients");
	const common = await getTranslations("common");
	const format = await getFormat();

	const href = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams({ ...(status !== "active" && { status }), ...(search && { search }), page: String(page) });
		next.delete("patient");
		for (const [k, v] of Object.entries(changes)) {
			if (v === null) next.delete(k);
			else next.set(k, v);
		}
		if (next.get("page") === "1") next.delete("page");
		const qs = next.toString();
		return qs ? `/patients?${qs}` : "/patients";
	};

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<LuUsers className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">{t("title")}</h1>
						<p className="text-muted-foreground text-sm">
							{t(status === "archived" ? "countArchived" : "countActive", { count: total })}
							{search && ` ${t("forSearch", { search })}`}
							{space && ` · ${spaceLabel(space)}`}
						</p>
					</div>
				</div>
				<Button asChild>
					<Link href={href({ nouveau: "1" })} scroll={false}>
						<LuPlus /> {t("new")}
					</Link>
				</Button>
			</header>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<nav className="bg-muted flex rounded-lg p-0.5 text-sm" aria-label={t("status.label")}>
					{STATUSES.map((s) => (
						<Link
							key={s}
							href={href({ status: s === "active" ? null : s, page: null })}
							aria-current={status === s ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 transition-colors",
								status === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{t(`status.${s}`)}
						</Link>
					))}
				</nav>
				<Suspense>
					<PatientsSearch />
				</Suspense>
			</div>

			<div className="bg-card overflow-hidden rounded-xl border">
				{data.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
						<LuUsers className="text-muted-foreground size-6" />
						<p className="font-medium">
							{t(search ? "empty.search" : `empty.${status}`)}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{t(search ? "empty.searchHint" : `empty.${status}Hint`)}
						</p>
						{!search && status === "active" && (
							<Button asChild size="sm" className="mt-2">
								<Link href={href({ nouveau: "1" })} scroll={false}>
									<LuPlus /> {t("new")}
								</Link>
							</Button>
						)}
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-28">{t("table.file")}</TableHead>
								<TableHead>{t("table.patient")}</TableHead>
								<TableHead className="hidden md:table-cell">{t("table.phone")}</TableHead>
								<TableHead className="hidden lg:table-cell">{t("table.cin")}</TableHead>
								<TableHead className="hidden lg:table-cell">{t("table.coverage")}</TableHead>
								<TableHead className="hidden xl:table-cell">{t("table.created")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((p) => {
								const age = ageOf(p.birthDate);
								return (
									<TableRow key={p.id} className="relative">
										<TableCell className="text-muted-foreground font-mono text-xs">
											{formatFileNumber(p.fileNumber)}
										</TableCell>
										<TableCell>
											{/* The whole row opens the file. */}
											<Link
												href={href({ patient: p.id })}
												scroll={false}
												className="font-medium after:absolute after:inset-0"
											>
												{fullName(p)}
											</Link>
											{/* Above the row link, so its tooltip opens. */}
											<NoShowBadge count={p.noShows} className="relative z-10 ms-2" />
											<p className="text-muted-foreground text-xs">
												{[common(`sex.${p.sex}`), age !== null && common("age", { age }), p.city].filter(Boolean).join(" · ")}
											</p>
										</TableCell>
										<TableCell className="hidden tabular-nums md:table-cell">{formatPhone(p.phone) || "—"}</TableCell>
										<TableCell className="hidden font-mono text-xs lg:table-cell">{p.cin ?? "—"}</TableCell>
										<TableCell className="hidden lg:table-cell">{common(`coverage.${p.coverage}`)}</TableCell>
										<TableCell className="text-muted-foreground hidden xl:table-cell">
											{format.date(p.createdAt, { month: "short" })}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</div>

			{pageCount > 1 && (
				<nav className="flex items-center justify-end gap-2 text-sm" aria-label={common("pagination.label")}>
					<span className="text-muted-foreground me-2">
						{common("pagination.page", { page, total: pageCount })}
					</span>
					<Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
						<Link href={href({ page: String(page - 1) })}>
							<LuChevronLeft className="rtl:rotate-180" /> {common("pagination.previous")}
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm" aria-disabled={page >= pageCount} className={cn(page >= pageCount && "pointer-events-none opacity-50")}>
						<Link href={href({ page: String(page + 1) })}>
							{common("pagination.next")} <LuChevronRight className="rtl:rotate-180" />
						</Link>
					</Button>
				</nav>
			)}
			<Suspense>
				<PatientSheet medical={medical} />
			</Suspense>
		</div>
	);
}
