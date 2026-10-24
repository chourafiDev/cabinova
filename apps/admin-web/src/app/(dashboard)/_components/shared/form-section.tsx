/**
 * A numbered form section (create / edit pages): icon with its step number,
 * a title, one line on what it's for, then the fields. Shared so every form
 * reads the same way.
 */
export function FormSection({
	step,
	icon: Icon,
	title,
	description,
	action,
	children,
}: {
	step: number;
	icon: React.ElementType;
	title: string;
	description: string;
	/** Controls aligned right of the title (e.g. a monthly/annual switch). */
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border bg-card p-5">
			<header className="mb-4 flex items-start gap-3">
				<span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Icon className="size-4" />
					<span className="absolute -end-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-background text-[10px] font-semibold ring-1 ring-border">
						{step}
					</span>
				</span>
				<div className="grid min-w-0 flex-1 gap-0.5">
					<h2 className="font-semibold leading-tight">{title}</h2>
					<p className="text-xs text-muted-foreground">{description}</p>
				</div>
				{action}
			</header>
			<div className="grid gap-4">{children}</div>
		</section>
	);
}
