import { cn } from "@/lib/utils";

/** A block of the page: a title, one line of context, an optional control. */
export function Panel({
	title,
	description,
	action,
	className,
	children,
}: {
	title: string;
	description?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-5", className)}>
			<header className="flex items-start justify-between gap-3">
				<div className="grid min-w-0 gap-0.5">
					<h2 className="font-semibold">{title}</h2>
					{description && <div className="text-muted-foreground text-sm">{description}</div>}
				</div>
				{action}
			</header>
			<div className="min-h-0 flex-1">{children}</div>
		</section>
	);
}
