import { MAGNITUDE } from "@/lib/reports";

/**
 * Horizontal magnitude bars (one hue), each labelled with its value at the
 * tip — no legend: the card's title says what is measured.
 */
export function Bars({
	rows,
	format = (v) => String(v),
	empty = "Aucune donnée sur la période.",
}: {
	rows: { key: string; label: React.ReactNode; value: number; hint?: string }[];
	format?: (value: number) => string;
	empty?: string;
}) {
	const max = Math.max(0, ...rows.map((r) => r.value));
	if (max === 0) return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>;
	return (
		<ul className="grid min-w-0 grid-cols-1 gap-2.5">
			{rows.map((r) => (
				<li key={r.key} className="grid min-w-0 gap-1" title={r.hint}>
					<div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
						<span className="min-w-0 truncate">{r.label}</span>
						<span className="font-medium tabular-nums">{format(r.value)}</span>
					</div>
					<div className="bg-muted h-2 overflow-hidden rounded-full">
						<div
							className="h-full rounded-full"
							style={{ width: `${(r.value / max) * 100}%`, background: MAGNITUDE }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

/** "12 (30 %)": a count with its share of the total. */
export const withShare = (total: number) => (value: number) =>
	total > 0 ? `${value} (${Math.round((value / total) * 100)} %)` : String(value);
