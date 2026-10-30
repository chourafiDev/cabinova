import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LuChevronLeft, LuChevronRight, LuShieldAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
	ACTIVITY_CATEGORIES,
	type ActivityEntry,
	type ActivityPage,
	activityDetail,
	activityVerb,
	isFailedLogin,
} from "@/lib/activity";
import { formatDate } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { SettingsCard } from "../_components/settings-card";
import { ActivityFilters } from "./_components/activity-filters";

export const metadata: Metadata = { title: "Journal d’activité · Paramètres" };

const clock = new Intl.DateTimeFormat("fr-MA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" });

function Entry({ entry }: { entry: ActivityEntry }) {
	const failed = isFailedLogin(entry.action);
	const detail = activityDetail(entry);
	return (
		<li className="flex items-baseline gap-3 py-2.5 text-sm">
			<time dateTime={entry.createdAt} className="text-muted-foreground w-11 shrink-0 text-xs tabular-nums">
				{clock.format(new Date(entry.createdAt))}
			</time>
			{failed ? (
				<p className="min-w-0 text-amber-800">
					<LuShieldAlert className="me-1 inline size-3.5" />
					Connexion refusée pour <span className="font-medium">{entry.target}</span>
				</p>
			) : (
				<p className="min-w-0">
					<span className="font-medium">{entry.actorName ?? "Compte supprimé"}</span> {activityVerb(entry.action)}
					{entry.target && <span className="font-medium"> {entry.target}</span>}
					{detail && <span className="text-muted-foreground"> · {detail}</span>}
				</p>
			)}
		</li>
	);
}

/** The cabinet's journal, for the responsible doctor: a year of who did what. */
export default async function ActivityPage({ searchParams }: PageProps<"/settings/activity">) {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const params = await searchParams;
	const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
	const category = ACTIVITY_CATEGORIES.some((c) => c.key === params.categorie) ? one(params.categorie) : undefined;
	const userId = one(params.membre);
	const search = one(params.recherche)?.trim();
	const page = Math.max(1, Number(one(params.page)) || 1);

	const query = new URLSearchParams({ page: String(page) });
	if (category) query.set("category", category);
	if (userId) query.set("userId", userId);
	if (search) query.set("search", search);
	const { data, total, pageCount, people } = await apiGet<ActivityPage>(`/activity?${query}`);

	const href = (to: number) => {
		const next = new URLSearchParams({
			...(category && { categorie: category }),
			...(userId && { membre: userId }),
			...(search && { recherche: search }),
			...(to > 1 && { page: String(to) }),
		});
		return `/settings/activity?${next}`;
	};
	const days = Map.groupBy(data, (e) => dayKey.format(new Date(e.createdAt)));

	return (
		<SettingsCard
			title="Journal d’activité"
			description="Qui a fait quoi dans le cabinet, conservé un an. Il ne contient aucune donnée médicale."
		>
			<div className="grid gap-4">
				<ActivityFilters category={category} userId={userId} search={search} people={people} />
				{data.length === 0 ? (
					<p className="text-muted-foreground py-10 text-center text-sm">Aucune activité pour ces filtres.</p>
				) : (
					<div className="grid gap-4">
						{[...days].map(([day, entries]) => (
							<section key={day}>
								<h3 className="text-muted-foreground bg-muted/50 rounded-md px-2 py-1 text-xs font-medium first-letter:uppercase">
									{formatDate(`${day}T12:00:00`, { weekday: "long", month: "long" })}
								</h3>
								<ul className="divide-y">
									{entries.map((e) => (
										<Entry key={e.id} entry={e} />
									))}
								</ul>
							</section>
						))}
					</div>
				)}
				{pageCount > 1 && (
					<nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
						<span className="text-muted-foreground">
							Page {page} sur {pageCount} · {total} entrées
						</span>
						<span className="flex gap-1">
							<Button asChild={page > 1} size="icon" variant="outline" className="size-8" disabled={page <= 1} aria-label="Page précédente">
								{page > 1 ? (
									<Link href={href(page - 1)} scroll={false}>
										<LuChevronLeft />
									</Link>
								) : (
									<LuChevronLeft />
								)}
							</Button>
							<Button
								asChild={page < pageCount}
								size="icon"
								variant="outline"
								className="size-8"
								disabled={page >= pageCount}
								aria-label="Page suivante"
							>
								{page < pageCount ? (
									<Link href={href(page + 1)} scroll={false}>
										<LuChevronRight />
									</Link>
								) : (
									<LuChevronRight />
								)}
							</Button>
						</span>
					</nav>
				)}
			</div>
		</SettingsCard>
	);
}
