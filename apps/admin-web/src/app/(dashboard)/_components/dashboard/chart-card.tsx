import { cn } from "@/lib/utils";

/**
 * Dashboard chart card: small eyebrow, bold title, optional headline figure,
 * and controls (legend, range switch) on the right — one header for every
 * statistic so the grid reads as one system.
 */
export function ChartCard({
	eyebrow = "Statistiques",
	title,
	headline,
	action,
	className,
	children,
}: {
	eyebrow?: string;
	title: string;
	/** A key figure under the title, e.g. "+3 nouveaux". */
	headline?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("flex flex-col rounded-xl border bg-card p-5", className)}>
			<header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
				<div className="grid gap-0.5">
					<span className="text-xs text-muted-foreground">{eyebrow}</span>
					<h2 className="text-base font-semibold leading-tight">{title}</h2>
					{headline && <div className="mt-1">{headline}</div>}
				</div>
				{action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
			</header>
			<div className="min-h-0 flex-1">{children}</div>
		</section>
	);
}
