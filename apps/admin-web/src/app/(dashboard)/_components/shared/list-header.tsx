"use client";

import { Loader, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useListTransition } from "./list-transition";

interface ListHeaderProps {
	/** A rendered icon element, e.g. <HiCube /> (elements can come from server pages). */
	icon: React.ReactElement<{ className?: string }>;
	/** Items matching the current filters. */
	total: number;
	label: { singular: string; plural: string };
	create?: { href: string; label: string };
	/** Custom action instead of a "create" link (e.g. a button opening a dialog). */
	action?: React.ReactNode;
}

/** "24 Patients  [+ Nouveau patient]" — top of every list page. */
export function ListHeader({ icon, total, label, create, action }: ListHeaderProps) {
	const { isPending } = useListTransition();

	return (
		<div className="flex md:flex-row flex-col justify-between md:items-center items-start gap-2 pb-4 mb-4 border-b border-dashed border-foreground/20">
			<div className="flex items-center gap-2">
				<div className="bg-primary/10 size-8 rounded-md flex items-center justify-center">
					<span className="flex text-primary [&>svg]:size-3.5">{icon}</span>
				</div>
				<h1 className="text-foreground text-sm font-medium flex items-center gap-1">
					{isPending ? (
						<Loader className="size-4 animate-spin text-primary mr-1" />
					) : (
						<span className="text-primary font-semibold text-xl mr-1 tabular-nums">
							{total}
						</span>
					)}
					{total > 1 ? label.plural : label.singular}
				</h1>
			</div>
			{action}
			{create && (
				<Button asChild className="md:w-auto w-full">
					<Link href={create.href}>
						<Plus className="size-4 mr-2" />
						{create.label}
					</Link>
				</Button>
			)}
		</div>
	);
}
