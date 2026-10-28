import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
	ageOf,
	COVERAGE_LABELS,
	formatFileNumber,
	formatPhone,
	fullName,
	type PatientsPage,
	SEX_LABELS,
} from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { PatientsSearch } from "./_components/patients-search";

export const metadata: Metadata = { title: "Patients" };

const PER_PAGE = 20;
const STATUSES = { active: "Actifs", archived: "Archivés" } as const;
type Status = keyof typeof STATUSES;

/** The cabinet's patients: search, active / archived, 20 per page. */
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

	const href = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams({ ...(status !== "active" && { status }), ...(search && { search }), page: String(page) });
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
						<Users className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">Patients</h1>
						<p className="text-muted-foreground text-sm">
							{total} patient{total > 1 ? "s" : ""} {status === "archived" ? "archivé" : "actif"}
							{total > 1 ? "s" : ""}
							{search && ` pour « ${search} »`}
							{space && ` · ${spaceLabel(space)}`}
						</p>
					</div>
				</div>
				<Button asChild>
					<Link href="/patients/new">
						<Plus /> Nouveau patient
					</Link>
				</Button>
			</header>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<nav className="bg-muted flex rounded-lg p-0.5 text-sm" aria-label="Statut">
					{(Object.keys(STATUSES) as Status[]).map((s) => (
						<Link
							key={s}
							href={href({ status: s === "active" ? null : s, page: null })}
							aria-current={status === s ? "page" : undefined}
							className={cn(
								"rounded-md px-3 py-1 transition-colors",
								status === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{STATUSES[s]}
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
						<Users className="text-muted-foreground size-6" />
						<p className="font-medium">
							{search ? "Aucun patient trouvé" : status === "archived" ? "Aucun dossier archivé" : "Aucun patient pour l’instant"}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{search
								? "Vérifiez l’orthographe, ou cherchez par téléphone, CIN ou n° de dossier."
								: status === "archived"
									? "Les dossiers archivés apparaissent ici ; ils ne sont jamais supprimés."
									: "Créez le premier dossier pour commencer."}
						</p>
						{!search && status === "active" && (
							<Button asChild size="sm" className="mt-2">
								<Link href="/patients/new">
									<Plus /> Nouveau patient
								</Link>
							</Button>
						)}
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-28">Dossier</TableHead>
								<TableHead>Patient</TableHead>
								<TableHead className="hidden md:table-cell">Téléphone</TableHead>
								<TableHead className="hidden lg:table-cell">CIN</TableHead>
								<TableHead className="hidden lg:table-cell">Couverture</TableHead>
								<TableHead className="hidden xl:table-cell">Créé le</TableHead>
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
											<Link href={`/patients/${p.id}`} className="font-medium after:absolute after:inset-0">
												{fullName(p)}
											</Link>
											<p className="text-muted-foreground text-xs">
												{[SEX_LABELS[p.sex], age !== null && `${age} ans`, p.city].filter(Boolean).join(" · ")}
											</p>
										</TableCell>
										<TableCell className="hidden tabular-nums md:table-cell">{formatPhone(p.phone) || "—"}</TableCell>
										<TableCell className="hidden font-mono text-xs lg:table-cell">{p.cin ?? "—"}</TableCell>
										<TableCell className="hidden lg:table-cell">{COVERAGE_LABELS[p.coverage]}</TableCell>
										<TableCell className="text-muted-foreground hidden xl:table-cell">
											{formatDate(p.createdAt, { month: "short" })}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</div>

			{pageCount > 1 && (
				<nav className="flex items-center justify-end gap-2 text-sm" aria-label="Pagination">
					<span className="text-muted-foreground me-2">
						Page {page} sur {pageCount}
					</span>
					<Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
						<Link href={href({ page: String(page - 1) })}>
							<ChevronLeft /> Précédente
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm" aria-disabled={page >= pageCount} className={cn(page >= pageCount && "pointer-events-none opacity-50")}>
						<Link href={href({ page: String(page + 1) })}>
							Suivante <ChevronRight />
						</Link>
					</Button>
				</nav>
			)}
		</div>
	);
}
