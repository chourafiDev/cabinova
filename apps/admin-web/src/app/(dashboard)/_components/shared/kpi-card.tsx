import { EllipsisVertical } from "lucide-react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { LuArrowDown, LuArrowUp, LuInfo } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiAction = { label: string; href: string };

/**
 * Change vs. the previous period, e.g. 12 → "+12 %", -3 (pts) → "-3 pts".
 * null = nothing to compare with. `invert` when a rise is bad (losses, delays).
 */
function Change({ value, unit, invert }: { value: number | null; unit: "%" | "pts"; invert?: boolean }) {
	if (value === null) return <span className="text-muted-foreground">Nouveau</span>;
	const good = invert ? value < 0 : value > 0;
	const bad = invert ? value > 0 : value < 0;
	return (
		<span
			className={cn(
				"flex items-center gap-0.5 font-medium tabular-nums",
				good ? "text-green" : bad ? "text-destructive" : "text-muted-foreground",
			)}
		>
			{value > 0 ? <LuArrowUp className="size-3.5" /> : value < 0 ? <LuArrowDown className="size-3.5" /> : null}
			{value > 0 ? "+" : ""}
			{value} {unit}
		</span>
	);
}

/**
 * Statistic card: icon + uppercase title + "⋮" menu, then a grey panel with
 * the value, the change and the period. Used on the dashboard and Revenus.
 */
export function KpiCard({
	icon: Icon,
	title,
	value,
	valueClassName,
	suffix,
	change,
	changeUnit = "%",
	invert,
	period,
	hint,
	actions = [],
}: {
	icon: IconType;
	title: string;
	value: React.ReactNode;
	/** Colour of the value, e.g. "text-red-700" for a worrying figure. */
	valueClassName?: string;
	/** Small unit after the value, e.g. "MAD". */
	suffix?: string;
	/** undefined = a snapshot ("right now"), no comparison shown. */
	change?: number | null;
	changeUnit?: "%" | "pts";
	invert?: boolean;
	/** e.g. "7 derniers jours". */
	period: string;
	/** What the number means (shown in the ⋮ menu). */
	hint?: string;
	actions?: KpiAction[];
}) {
	return (
		<div className="bg-card rounded-xl border p-1.5">
			<div className="flex items-center gap-2.5 py-1.5 ps-2 pe-0.5">
				<span className="bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
					<Icon className="size-3.5" />
				</span>
				<h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide uppercase">{title}</h3>
				{(hint || actions.length > 0) && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="ghost" size="icon-sm" aria-label={`Options : ${title}`}>
								<EllipsisVertical className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							{hint && (
								<DropdownMenuLabel className="text-muted-foreground flex gap-2 text-xs font-normal">
									<LuInfo className="mt-0.5 size-3.5 shrink-0" />
									{hint}
								</DropdownMenuLabel>
							)}
							{hint && actions.length > 0 && <DropdownMenuSeparator />}
							{actions.map((action) => (
								<DropdownMenuItem key={action.href} asChild>
									<Link href={action.href}>{action.label}</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
			<div className="bg-muted/70 rounded-lg px-3.5 pt-3 pb-3">
				<p
					className={cn(
						"flex items-baseline gap-1.5 text-[28px] leading-tight font-medium tracking-tight tabular-nums",
						valueClassName,
					)}
				>
					{value}
					{suffix && <span className="text-muted-foreground text-sm font-normal">{suffix}</span>}
				</p>
				<div className="mt-3 flex items-center justify-between gap-2 text-xs">
					{change === undefined ? <span /> : <Change value={change} unit={changeUnit} invert={invert} />}
					<span className="text-muted-foreground truncate">{period}</span>
				</div>
			</div>
		</div>
	);
}

export function KpiCardSkeleton() {
	return (
		<div className="bg-card rounded-xl border p-1.5">
			<div className="flex items-center gap-2.5 py-1.5 ps-2">
				<Skeleton className="size-7 rounded-md" />
				<Skeleton className="h-4 w-28" />
			</div>
			<div className="bg-muted/70 rounded-lg p-3.5">
				<Skeleton className="h-8 w-24" />
				<div className="mt-3 flex justify-between">
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
		</div>
	);
}
