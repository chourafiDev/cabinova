"use client";

import { Subscribe, type Table } from "@tanstack/react-table";
import { ChevronDown, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";
import { useListTransition } from "./list-transition";

export interface BulkAction {
	id: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	destructive?: boolean;
	/** Ask before running (e.g. deletes). */
	confirm?: { title: (count: number) => string; description: string };
	/** Runs the action; returns the success message, or throws with a message. */
	run: (ids: string[]) => Promise<string>;
	/** Read-only actions (e.g. export): keep the selection, don't refresh the list. */
	keepSelection?: boolean;
	/** Actions sharing a group are shown as one dropdown (e.g. "Assigner ⌄"). */
	group?: { label: string; icon: React.ComponentType<{ className?: string }> };
}

interface BulkActionsHeaderProps<TData extends { id: string }> {
	table: Table<DataTableFeatures, TData>;
	actions: BulkAction[];
}

/**
 * Header cell of a table's select column. Once rows are selected it shows a
 * Shopify-style bar over the whole header row ("2 sélectionnés ⌄ · actions").
 * Pair with BULK_BAR_TABLE_CLASS on the DataTable to size the bar and hide
 * the header labels underneath it.
 */
export function BulkActionsHeader<TData extends { id: string }>({
	table,
	actions,
}: BulkActionsHeaderProps<TData>) {
	const router = useRouter();
	const { startTransition } = useListTransition();
	const [busy, setBusy] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<BulkAction | null>(null);

	const run = async (action: BulkAction) => {
		const ids = table.getSelectedRowModel().rows.map((r) => r.original.id);
		setBusy(action.id);
		try {
			toast.success(await action.run(ids));
			if (!action.keepSelection) {
				table.resetRowSelection();
				startTransition(() => router.refresh());
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "L'action a échoué");
		} finally {
			setBusy(null);
			setConfirming(null);
		}
	};

	return (
		<Subscribe
			source={table.atoms.rowSelection}
			selector={(selection) => Object.values(selection).filter(Boolean).length}
		>
			{(count) => {
				const checked = table.getIsAllPageRowsSelected()
					? true
					: count > 0
						? "indeterminate"
						: false;
				const selectAll = (
					<Checkbox
						aria-label="Tout sélectionner"
						checked={checked}
						onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
					/>
				);

				return (
					<div className="relative flex items-center">
						{selectAll}
						{count > 0 && (
							<div
								data-bulk-bar
								className="bg-muted absolute top-1/2 -left-2 z-10 flex h-10 w-[calc(100cqw-2px)] -translate-y-1/2 items-center gap-2 px-2"
							>
								{selectAll}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button type="button" variant="ghost" size="sm" className="gap-1 font-medium">
											{count} sélectionné{count > 1 ? "s" : ""}
											<ChevronDown className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-56">
										<DropdownMenuItem onSelect={() => table.toggleAllPageRowsSelected(true)}>
											Sélectionner toute la page
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => table.resetRowSelection()}>
											Tout désélectionner
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								<div className="ms-auto flex items-center gap-2">
									{actions.filter((a) => !a.group).map((action) => (
										<Button
											key={action.id}
											type="button"
											variant="outline"
											size="sm"
											className={cn(action.destructive && "text-destructive hover:text-destructive")}
											disabled={busy !== null}
											onClick={() => (action.confirm ? setConfirming(action) : run(action))}
										>
											{busy === action.id ? (
												<Loader className="size-4 animate-spin" />
											) : (
												<action.icon className="size-4" />
											)}
											{action.label}
										</Button>
									))}
									{[...new Map(actions.filter((a) => a.group).map((a) => [a.group!.label, a.group!])).values()].map(
										(group) => {
											const items = actions.filter((a) => a.group?.label === group.label);
											const running = items.some((a) => a.id === busy);
											return (
												<DropdownMenu key={group.label}>
													<DropdownMenuTrigger asChild>
														<Button type="button" variant="outline" size="sm" disabled={busy !== null}>
															{running ? <Loader className="size-4 animate-spin" /> : <group.icon className="size-4" />}
															{group.label}
															<ChevronDown className="size-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="min-w-52">
														{items.map((action) => (
															<DropdownMenuItem
																key={action.id}
																variant={action.destructive ? "destructive" : "default"}
																onSelect={() => (action.confirm ? setConfirming(action) : run(action))}
															>
																<action.icon />
																{action.label}
															</DropdownMenuItem>
														))}
													</DropdownMenuContent>
												</DropdownMenu>
											);
										},
									)}
								</div>

								<Dialog
									open={confirming !== null}
									onOpenChange={(open) => !open && busy === null && setConfirming(null)}
								>
									<DialogContent className="sm:max-w-[500px]">
										<DialogHeader>
											<DialogTitle>{confirming?.confirm?.title(count)}</DialogTitle>
											<DialogDescription>{confirming?.confirm?.description}</DialogDescription>
										</DialogHeader>
										<DialogFooter>
											<DialogClose asChild>
												<Button type="button" variant="outline" disabled={busy !== null}>
													Annuler
												</Button>
											</DialogClose>
											<Button
												type="button"
												variant={confirming?.destructive ? "destructive" : "default"}
												disabled={busy !== null}
												onClick={() => confirming && run(confirming)}
											>
												{busy !== null && <Loader className="size-4 animate-spin" />}
												{confirming?.label}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</div>
						)}
					</div>
				);
			}}
		</Subscribe>
	);
}

/** DataTable className that sizes the bulk bar (cqw) and hides labels under it. */
export const BULK_BAR_TABLE_CLASS =
	"@container [&_thead:has([data-bulk-bar])_th:not(:first-child)>*]:invisible";

export { plural } from "@/lib/plural";
