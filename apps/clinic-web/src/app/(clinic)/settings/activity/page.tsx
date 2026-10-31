import Link from "next/link";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LuChevronLeft, LuChevronRight, LuShieldAlert } from "react-icons/lu";
import { settingsTitle } from "@/i18n/titles";
import { Button } from "@/components/ui/button";
import {
	ACTIVITY_CATEGORIES,
	type ActivityEntry,
	type ActivityPage,
	actionKey,
	isFailedLogin,
} from "@/lib/activity";
import { getFormat } from "@/lib/get-format";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { useFormat } from "@/lib/use-format";
import { SettingsCard } from "../_components/settings-card";
import { ActivityFilters } from "./_components/activity-filters";

export const generateMetadata = () => settingsTitle("activity");

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" });

function Entry({ entry }: { entry: ActivityEntry }) {
	const t = useTranslations("settings.activity");
	const status = useTranslations("common.appointmentStatus");
	const format = useFormat();
	const failed = isFailedLogin(entry.action);
	const key = actionKey(entry.action);
	const detail =
		entry.action === "appointment.status" && status.has(entry.detail as "completed")
			? status(entry.detail as "completed")
			: entry.action === "team.two_factor_required" && entry.detail
				? t(entry.detail === "true" ? "required" : "optional")
				: entry.detail;
	return (
		<li className="flex items-baseline gap-3 py-2.5 text-sm">
			<time dateTime={entry.createdAt} className="text-muted-foreground w-11 shrink-0 text-xs tabular-nums">
				{format.clock(entry.createdAt)}
			</time>
			{failed ? (
				<p className="min-w-0 text-amber-800">
					<LuShieldAlert className="me-1 inline size-3.5" />
					{t.rich("failedLogin", {
						target: entry.target ?? "",
						strong: (chunks) => <span className="font-medium">{chunks}</span>,
					})}
				</p>
			) : (
				<p className="min-w-0">
					<span className="font-medium">{entry.actorName ?? t("deletedAccount")}</span>{" "}
					{t.has(`actions.${key}`) ? t(`actions.${key}`) : entry.action}
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
	const category = ACTIVITY_CATEGORIES.some((c) => c === params.categorie) ? one(params.categorie) : undefined;
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
	const t = await getTranslations("settings.activity");
	const common = await getTranslations("common");
	const format = await getFormat();

	return (
		<SettingsCard
			title={t("title")}
			description={t("description")}
		>
			<div className="grid gap-4">
				<ActivityFilters category={category} userId={userId} search={search} people={people} />
				{data.length === 0 ? (
					<p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
				) : (
					<div className="grid gap-4">
						{[...days].map(([day, entries]) => (
							<section key={day}>
								<h3 className="text-muted-foreground bg-muted/50 rounded-md px-2 py-1 text-xs font-medium first-letter:uppercase">
									{format.date(`${day}T12:00:00`, { weekday: "long", month: "long" })}
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
					<nav className="flex items-center justify-between gap-3 text-sm" aria-label={common("pagination.label")}>
						<span className="text-muted-foreground">
							{common("pagination.page", { page, total: pageCount })} · {t("entries", { total })}
						</span>
						<span className="flex gap-1">
							<Button asChild={page > 1} size="icon" variant="outline" className="size-8" disabled={page <= 1} aria-label={t("previous")}>
								{page > 1 ? (
									<Link href={href(page - 1)} scroll={false}>
										<LuChevronLeft className="rtl:rotate-180" />
									</Link>
								) : (
									<LuChevronLeft className="rtl:rotate-180" />
								)}
							</Button>
							<Button
								asChild={page < pageCount}
								size="icon"
								variant="outline"
								className="size-8"
								disabled={page >= pageCount}
								aria-label={t("next")}
							>
								{page < pageCount ? (
									<Link href={href(page + 1)} scroll={false}>
										<LuChevronRight className="rtl:rotate-180" />
									</Link>
								) : (
									<LuChevronRight className="rtl:rotate-180" />
								)}
							</Button>
						</span>
					</nav>
				)}
			</div>
		</SettingsCard>
	);
}
