"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuCheck, LuChevronsUpDown } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Act } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * Searchable act select (Paramètres › Tarifs): by name or abbreviation, so
 * "cs" finds Consultation. The value is the act's name, as appointments keep
 * it. `children` replaces the default field trigger (e.g. an "add" button).
 */
export function ActPicker({
	acts,
	value,
	onChange,
	none,
	placeholder,
	invalid,
	disabled,
	id,
	children,
}: {
	acts: Act[];
	value?: string | null;
	onChange: (act: Act | null) => void;
	/** Label of a "no act" choice; omitted, an act is required. */
	none?: string;
	placeholder?: string;
	invalid?: boolean;
	disabled?: boolean;
	id?: string;
	children?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("common.actPicker");
	const format = useFormat();
	const selected = acts.find((a) => a.name === value);

	const pick = (act: Act | null) => {
		onChange(act);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{children ?? (
					<Button
						id={id}
						type="button"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						aria-invalid={invalid}
						disabled={disabled}
						className={cn("h-10 w-full justify-between font-normal", !value && "text-muted-foreground")}
					>
						<span className="flex min-w-0 items-center gap-2">
							{selected?.abbreviation && <Abbreviation>{selected.abbreviation}</Abbreviation>}
							<span className="truncate">{value || placeholder || t("placeholder")}</span>
						</span>
						<LuChevronsUpDown className="size-4 shrink-0 opacity-50" />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
				<Command>
					<CommandInput placeholder={t("search")} />
					<CommandList>
						<CommandEmpty>{t("empty")}</CommandEmpty>
						<CommandGroup>
							{none && (
								<CommandItem value="__none__" onSelect={() => pick(null)}>
									<span className="text-muted-foreground flex-1">{none}</span>
									<LuCheck className={cn("size-4", !value ? "opacity-100" : "opacity-0")} />
								</CommandItem>
							)}
							{acts.map((act) => (
								<CommandItem
									key={act.id}
									value={act.id}
									keywords={[act.name, act.abbreviation ?? ""]}
									onSelect={() => pick(act)}
								>
									{act.abbreviation && <Abbreviation>{act.abbreviation}</Abbreviation>}
									<span className="min-w-0 flex-1 truncate">{act.name}</span>
									<span className="text-muted-foreground text-xs tabular-nums">{format.mad(act.price)}</span>
									<LuCheck className={cn("size-4", value === act.name ? "opacity-100" : "opacity-0")} />
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** An act's short code, as on the agenda. */
export function Abbreviation({ className, children }: { className?: string; children: React.ReactNode }) {
	return (
		<span
			dir="ltr"
			className={cn("bg-muted text-muted-foreground shrink-0 rounded px-1 font-mono text-[11px] font-medium", className)}
		>
			{children}
		</span>
	);
}
