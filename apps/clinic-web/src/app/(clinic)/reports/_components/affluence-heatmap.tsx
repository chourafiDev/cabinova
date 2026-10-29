"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAGNITUDE, type Report, WEEKDAYS } from "@/lib/reports";

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const plural = (n: number) => `${n} rendez-vous`;

/**
 * Appointments by weekday and hour: one hue, more is darker. Hours span the
 * usual day (8 h – 18 h) and stretch to any appointment outside it.
 */
export function AffluenceHeatmap({ cells }: { cells: Report["affluence"]["heatmap"] }) {
	const count = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
	const max = Math.max(0, ...cells.map((c) => c.count));
	const hours = cells.map((c) => c.hour);
	const first = Math.min(8, ...hours);
	const last = Math.max(18, ...hours);
	const range = Array.from({ length: last - first + 1 }, (_, i) => first + i);
	// Sunday only when something happened then.
	const days = cells.some((c) => c.weekday === 7) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
	const busiest = [...cells].sort((a, b) => b.count - a.count).slice(0, 3);

	if (max === 0) return <p className="text-muted-foreground py-6 text-center text-sm">Aucun rendez-vous sur la période.</p>;

	return (
		<div className="grid gap-3">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[420px] border-separate border-spacing-0.5 text-[10px]">
					<thead>
						<tr>
							<th className="w-9" />
							{range.map((h) => (
								<th key={h} className="text-muted-foreground font-normal tabular-nums">
									{h} h
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{days.map((d) => (
							<tr key={d}>
								<th scope="row" className="text-muted-foreground pe-1 text-start font-normal">
									{WEEKDAYS[d - 1]}
								</th>
								{range.map((h) => {
									const n = count.get(`${d}-${h}`) ?? 0;
									const label = `${DAY_NAMES[d - 1]} ${h} h – ${h + 1} h : ${plural(n)}`;
									return (
										<td key={h} className="p-0">
											<Tooltip>
												<TooltipTrigger asChild>
													<div
														tabIndex={0}
														aria-label={label}
														className="hover:ring-foreground/40 focus-visible:ring-foreground h-7 rounded-[4px] outline-none hover:ring-1 focus-visible:ring-2"
														style={{
															background:
																n === 0
																	? "var(--muted)"
																	: `color-mix(in oklab, ${MAGNITUDE} ${Math.round(15 + (n / max) * 85)}%, var(--card))`,
														}}
													/>
												</TooltipTrigger>
												<TooltipContent>
													<span className="font-semibold">{plural(n)}</span>{" "}
													<span className="capitalize">{DAY_NAMES[d - 1]}</span>, {h} h – {h + 1} h
												</TooltipContent>
											</Tooltip>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
				<p>
					Créneaux les plus chargés :{" "}
					{busiest.map((c, i) => (
						<span key={`${c.weekday}-${c.hour}`}>
							{i > 0 && ", "}
							<span className="text-foreground font-medium">
								{WEEKDAYS[c.weekday - 1].toLowerCase()}. {c.hour} h
							</span>{" "}
							({c.count})
						</span>
					))}
				</p>
				<span className="flex items-center gap-1.5" aria-hidden>
					Moins
					{[15, 40, 65, 100].map((p) => (
						<span
							key={p}
							className="size-3 rounded-[3px]"
							style={{ background: `color-mix(in oklab, ${MAGNITUDE} ${p}%, var(--card))` }}
						/>
					))}
					Plus
				</span>
			</div>
		</div>
	);
}
