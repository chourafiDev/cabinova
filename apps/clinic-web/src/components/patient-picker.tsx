"use client";

import { useQuery } from "@tanstack/react-query";
import { LuCheck, LuChevronsUpDown, LuLoader } from "react-icons/lu";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { api } from "@/lib/api-client";
import { formatFileNumber, formatPhone, fullName, type PatientsPage } from "@/lib/patients";
import { cn } from "@/lib/utils";

export type PickedPatient = { id: string; firstName: string; lastName: string; fileNumber: number };

/** Searchable patient select (name, phone, CIN or file number), active files only. */
export function PatientPicker({
	value,
	onChange,
	invalid,
	disabled,
	id,
}: {
	value: PickedPatient | null;
	onChange: (patient: PickedPatient) => void;
	invalid?: boolean;
	disabled?: boolean;
	id?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const setSearchDebounced = useDebouncedCallback(setSearch, 250);

	const { data, isFetching } = useQuery({
		queryKey: ["patient-picker", search],
		queryFn: () =>
			api<PatientsPage>(`/patients?${new URLSearchParams({ perPage: "8", ...(search && { search }) })}`),
		enabled: open,
		placeholderData: (previous) => previous,
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={invalid}
					disabled={disabled}
					className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
				>
					<span className="truncate">
						{value ? `${fullName(value)} · ${formatFileNumber(value.fileNumber)}` : "Rechercher un patient…"}
					</span>
					<LuChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
				{/* Server-side search: cmdk must not filter again. */}
				<Command shouldFilter={false}>
					<CommandInput placeholder="Nom, téléphone, CIN, n° de dossier…" onValueChange={setSearchDebounced} />
					<CommandList>
						<CommandEmpty>
							{isFetching ? <LuLoader className="mx-auto size-4 animate-spin" /> : "Aucun patient trouvé."}
						</CommandEmpty>
						<CommandGroup>
							{data?.data.map((p) => (
								<CommandItem
									key={p.id}
									value={p.id}
									onSelect={() => {
										onChange({ id: p.id, firstName: p.firstName, lastName: p.lastName, fileNumber: p.fileNumber });
										setOpen(false);
									}}
								>
									<div className="grid min-w-0 flex-1 leading-tight">
										<span className="truncate font-medium">{fullName(p)}</span>
										<span className="text-muted-foreground truncate text-xs tabular-nums">
											{formatFileNumber(p.fileNumber)}
											{p.phone && ` · ${formatPhone(p.phone)}`}
										</span>
									</div>
									<LuCheck className={cn("size-4", value?.id === p.id ? "opacity-100" : "opacity-0")} />
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
