"use client";

import { MOROCCO_HOLIDAY_KEYS, moroccoHolidays } from "@cabinova/morocco-time";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconFlag, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api-client";
import { dayKey, daysIn } from "@/lib/closures";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

type Key = (typeof MOROCCO_HOLIDAY_KEYS)[number];
type Next = { from: string; to: string; estimated: boolean };

/** Each holiday's next occurrence (its days together: the Aïds last two). */
function nextOccurrences(): Map<Key, Next> {
	const today = dayKey(new Date());
	const year = new Date().getFullYear();
	const next = new Map<Key, Next>();
	for (const h of [...moroccoHolidays(year), ...moroccoHolidays(year + 1)]) {
		if (h.date < today) continue;
		const found = next.get(h.key);
		if (!found) next.set(h.key, { from: h.date, to: h.date, estimated: h.estimated });
		else if (daysIn(found.to, h.date) === 2) found.to = h.date;
	}
	return next;
}

/**
 * Cabinet-wide: the public holidays that close the cabinet (checked, as by
 * default) and the ones it works. Closed ones are blocked in the agenda and
 * refused when booking, in every space.
 */
export function HolidaysCard({ initial }: { initial: string[] }) {
	const router = useRouter();
	const t = useTranslations("settings.holidays");
	const names = useTranslations("common.holidays");
	const common = useTranslations("settings.common");
	const fmt = useFormat();
	const [saved, setSaved] = useState(initial);
	const [open, setOpen] = useState(initial);
	const [saving, setSaving] = useState(false);
	const [next] = useState(nextOccurrences);

	const dirty = [...open].sort().join() !== [...saved].sort().join();
	const closed = MOROCCO_HOLIDAY_KEYS.length - open.length;
	const groups = [
		{ key: "national", items: MOROCCO_HOLIDAY_KEYS.filter((k) => !next.get(k)?.estimated) },
		{ key: "religious", items: MOROCCO_HOLIDAY_KEYS.filter((k) => next.get(k)?.estimated) },
	] as const;
	// The next occurrence: within the coming year, so no year.
	const date = (day: string) =>
		fmt.date(`${day}T12:00:00`, { weekday: "short", day: "numeric", month: "short", year: undefined });

	// Sets rather than flips: the click on the box also reaches its <label>.
	const setClosed = (key: Key, closes: boolean) =>
		setOpen((list) => (closes ? list.filter((k) => k !== key) : list.includes(key) ? list : [...list, key]));

	const save = async () => {
		setSaving(true);
		try {
			await api("/settings/holidays", { method: "PUT", body: JSON.stringify({ openHolidays: open }) });
			setSaved(open);
			toast.success(t("saved"));
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : common("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsCard
			id="holidays"
			title={t("title")}
			description={t("description")}
			action={
				<Button
					size="sm"
					variant="outline"
					onClick={() => setOpen(open.length === 0 ? [...MOROCCO_HOLIDAY_KEYS] : [])}
				>
					{open.length === 0 ? t("uncheckAll") : t("checkAll")}
				</Button>
			}
			footer={
				<>
					<p className="text-muted-foreground text-xs">
						{t("count", { closed, total: MOROCCO_HOLIDAY_KEYS.length })} · {t("hint")}
					</p>
					<Button size="sm" disabled={!dirty || saving} onClick={save}>
						{saving && <IconSpinner className="animate-spin" />} {common("save")}
					</Button>
				</>
			}
		>
			{/* Two columns only when the card is wide enough for the names. */}
			<div className="@container grid gap-5">
				{groups.map((group) => (
					<fieldset key={group.key} className="grid gap-2">
						<legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
							{t(group.key)}
						</legend>
						<div className="grid gap-2 @xl:grid-cols-2">
							{group.items.map((key) => {
								const isClosed = !open.includes(key);
								const when = next.get(key);
								return (
									<label
										key={key}
										className={cn(
											"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
											isClosed ? "bg-background hover:bg-muted/40" : "bg-muted/40 border-dashed",
										)}
									>
										<Checkbox
											checked={isClosed}
											onCheckedChange={(on) => setClosed(key, on === true)}
											aria-label={names(`names.${key}`)}
										/>
										<span className="min-w-0 flex-1">
											<span className={cn("block truncate text-sm font-medium", !isClosed && "text-muted-foreground")}>
												{names(`names.${key}`)}
											</span>
											<span className="text-muted-foreground block truncate text-xs first-letter:uppercase">
												{when && (when.from === when.to ? date(when.from) : `${date(when.from)} – ${date(when.to)}`)}
												{when?.estimated && ` · ${t("estimated")}`}
											</span>
											{!isClosed && <span className="text-muted-foreground block text-xs font-medium">{names("worked")}</span>}
										</span>
										{isClosed && <IconFlag className="size-4 shrink-0 text-red-600" aria-hidden />}
									</label>
								);
							})}
						</div>
					</fieldset>
				))}
			</div>
		</SettingsCard>
	);
}
