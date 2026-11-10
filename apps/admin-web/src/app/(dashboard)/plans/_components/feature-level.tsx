import { IconCheck, IconGauge, IconMinus, IconPlus, IconSettings } from "@/components/icons";
import { FEATURE_LEVELS, type FeatureLevel } from "@/lib/plans";
import { cn } from "@/lib/utils";

const ICONS: Record<FeatureLevel, { icon: React.ElementType; className: string }> = {
	included: { icon: IconCheck, className: "text-emerald-600" },
	limited: { icon: IconGauge, className: "text-amber-600" },
	addon: { icon: IconPlus, className: "text-sky-600" },
	custom: { icon: IconSettings, className: "text-violet-600" },
	none: { icon: IconMinus, className: "text-muted-foreground/60" },
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
