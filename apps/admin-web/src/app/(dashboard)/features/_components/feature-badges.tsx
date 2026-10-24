import { Badge } from "@/components/ui/badge";
import {
	FEATURE_LEVELS,
	FEATURE_STATUS_LABELS,
	FEATURE_STATUS_TONES,
	type FeatureLevel,
	type FeatureStatus,
} from "@/lib/features";
import { cn } from "@/lib/utils";

export function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", FEATURE_STATUS_TONES[status])}>
			{FEATURE_STATUS_LABELS[status]}
		</Badge>
	);
}

const LEVEL_TONES: Record<FeatureLevel, string> = {
	included: "bg-emerald-50 text-emerald-700",
	limited: "bg-amber-50 text-amber-800",
	addon: "bg-sky-50 text-sky-700",
	custom: "bg-violet-50 text-violet-700",
	none: "bg-muted text-muted-foreground",
};

export function LevelBadge({ level, className }: { level: FeatureLevel; className?: string }) {
	return (
		<Badge variant="outline" className={cn("border-transparent font-normal", LEVEL_TONES[level], className)}>
			{FEATURE_LEVELS[level]}
		</Badge>
	);
}
