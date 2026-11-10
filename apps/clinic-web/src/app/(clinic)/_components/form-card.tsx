import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The dashboard form card: compact header + content. */
export function FormCard({
	title,
	action,
	className,
	contentClassName,
	children,
}: {
	title?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
	contentClassName?: string;
	children: React.ReactNode;
}) {
	return (
		<Card className={cn("py-0 gap-0", className)}>
			{title && (
				<CardHeader className="p-3">
					<CardTitle>{title}</CardTitle>
					{action && <CardAction>{action}</CardAction>}
				</CardHeader>
			)}
			<CardContent className={cn("p-3", contentClassName)}>{children}</CardContent>
		</Card>
	);
}
