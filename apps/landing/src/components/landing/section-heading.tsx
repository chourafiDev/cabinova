import { cn } from "@/lib/utils";

/** The italic serif words that close a heading ("…en un seul endroit"). */
export function Accent({ children }: { children: React.ReactNode }) {
	return <span className="font-serif font-normal tracking-normal italic">{children}</span>;
}

/** A section's title and lead, centred or at the start. */
export function SectionHeading({
	eyebrow,
	title,
	description,
	className,
	align = "center",
}: {
	eyebrow?: string;
	title: React.ReactNode;
	description?: React.ReactNode;
	className?: string;
	align?: "center" | "start";
}) {
	return (
		<div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
			{eyebrow && (
				<p className={cn("bg-accent text-primary mb-4 w-fit rounded-full px-3 py-1 text-xs font-medium", align === "center" && "mx-auto")}>
					{eyebrow}
				</p>
			)}
			<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">{title}</h2>
			{description && <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">{description}</p>}
		</div>
	);
}
