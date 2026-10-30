import { MAGNITUDE } from "@/lib/reports";

/**
 * A ranked list: label, value and, with `total`, its share in a fixed
 * column, over a thin magnitude bar. No legend: the panel's title says what
 * is measured.
 */
export function Bars({
	rows,
	format = (v) => String(v),
	total,
	empty = "Aucune donnée sur la période.",
}: {
	rows: { key: string; label: React.ReactNode; value: number; detail?: string }[];
	format?: (value: number) => string;
	total?: number;
	empty?: string;
}) {
	const max = Math.max(0, ...rows.map((r) => r.value));
	if (max === 0) return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>;
	return (
		<ul className="grid min-w-0 grid-cols-1 gap-3">
			{rows.map((r) => (
				<li key={r.key} className="grid min-w-0 gap-1.5">
					<div className="flex min-w-0 items-baseline gap-3 text-sm">
						<span className="min-w-0 flex-1 truncate">
							{r.label}
							{r.detail && <span className="text-muted-foreground"> · {r.detail}</span>}
						</span>
						<span className="shrink-0 font-medium whitespace-nowrap tabular-nums">{format(r.value)}</span>
						{total ? (
							<span className="text-muted-foreground w-10 shrink-0 text-end tabular-nums">
								{Math.round((r.value / total) * 100)} %
							</span>
						) : null}
					</div>
					<div className="bg-muted h-1.5 overflow-hidden rounded-full">
						<div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: MAGNITUDE }} />
					</div>
				</li>
			))}
		</ul>
	);
}
