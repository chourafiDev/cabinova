import { LuInfo } from "react-icons/lu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Change } from "../../_components/kpi-card";

const WIDTH = 100;
const HEIGHT = 32;

/** The period's shape behind a figure: a thin line, no axes (decorative). */
function Sparkline({ values }: { values: number[] }) {
	if (values.length < 2) return <div className="h-8" />;
	const max = Math.max(...values, 1);
	const line = values
		.map((v, i) => `${(i / (values.length - 1)) * WIDTH},${HEIGHT - 2 - (v / max) * (HEIGHT - 4)}`)
		.join(" ");
	return (
		<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
			<polygon points={`0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`} fill="var(--primary)" fillOpacity={0.1} />
			<polyline
				points={line}
				fill="none"
				stroke="var(--primary)"
				strokeWidth={2}
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

/** One headline figure: label, value, change against the previous period, trend. */
export function StatCard({
	label,
	value,
	change,
	unit = "%",
	invert,
	hint,
	trend,
}: {
	label: string;
	value: React.ReactNode;
	change: number | null;
	unit?: "%" | "pts";
	/** A rise is bad (absences). */
	invert?: boolean;
	hint: string;
	trend: number[];
}) {
	return (
		<div className="bg-card flex min-w-40 flex-1 flex-col gap-3 rounded-xl border p-4">
			<Tooltip>
				<TooltipTrigger className="text-muted-foreground flex w-fit items-center gap-1 text-start text-sm">
					{label} <LuInfo className="size-3 opacity-60" />
				</TooltipTrigger>
				<TooltipContent className="max-w-56">{hint}</TooltipContent>
			</Tooltip>
			<div className="flex flex-wrap items-baseline justify-between gap-x-2">
				<p className="text-2xl font-semibold tracking-tight whitespace-nowrap tabular-nums">{value}</p>
				<span className="text-xs whitespace-nowrap">
					<Change value={change} unit={unit} invert={invert} />
				</span>
			</div>
			<Sparkline values={trend} />
		</div>
	);
}
