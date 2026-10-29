import { cn } from "@/lib/utils";

/**
 * One block of a settings page: title and explanation, the content, and an
 * optional footer (hint on the left, the action on the right).
 */
export function SettingsCard({
	title,
	description,
	action,
	footer,
	className,
	children,
}: {
	title: React.ReactNode;
	description?: React.ReactNode;
	/** Beside the title (e.g. "Nouvel espace"). */
	action?: React.ReactNode;
	footer?: React.ReactNode;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<section className={cn("bg-card overflow-hidden rounded-xl border", className)}>
			<div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
				<div className="grid gap-1">
					<h2 className="font-semibold leading-tight">{title}</h2>
					{description && <p className="text-muted-foreground text-sm">{description}</p>}
				</div>
				{action}
			</div>
			{children && <div className="p-5">{children}</div>}
			{footer && (
				<div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">{footer}</div>
			)}
		</section>
	);
}
