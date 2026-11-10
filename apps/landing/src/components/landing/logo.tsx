import { cn } from "@/lib/utils";

/** The brand mark (same letter mark as the clinic app) and name. */
export function Logo({ className }: { className?: string }) {
	return (
		<span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
			<span className="bg-brand flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm">C</span>
			<span className="text-lg">Cabinova</span>
		</span>
	);
}
