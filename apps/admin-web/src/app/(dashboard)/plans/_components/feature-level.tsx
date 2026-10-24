import { Check, Minus, Plus, Settings2, Gauge } from "lucide-react";
import { FEATURE_LEVELS, type FeatureLevel } from "@/lib/plans";
import { cn } from "@/lib/utils";

const ICONS: Record<FeatureLevel, { icon: React.ElementType; className: string }> = {
	included: { icon: Check, className: "text-emerald-600" },
	limited: { icon: Gauge, className: "text-amber-600" },
	addon: { icon: Plus, className: "text-sky-600" },
	custom: { icon: Settings2, className: "text-violet-600" },
	none: { icon: Minus, className: "text-muted-foreground/60" },
};

/** One cell of the plan matrix: icon + label ("Inclus", "Limité"…). */
export function FeatureLevelBadge({ level }: { level: FeatureLevel }) {
	const { icon: Icon, className } = ICONS[level];
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs", level === "none" && "text-muted-foreground")}>
			<Icon className={cn("size-3.5", className)} aria-hidden />
			{FEATURE_LEVELS[level]}
		</span>
	);
}
