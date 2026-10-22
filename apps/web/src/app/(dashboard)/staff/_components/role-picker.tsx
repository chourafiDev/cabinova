"use client";

import { Check } from "lucide-react";
import type { Role } from "@/lib/team";
import { cn } from "@/lib/utils";

/** Checkbox cards: each role with what it is for. A member can have several. */
export function RolePicker({
	roles,
	value,
	onChange,
	disabled,
}: {
	roles: Role[];
	value: string[];
	onChange: (roleIds: string[]) => void;
	disabled?: boolean;
}) {
	const toggle = (id: string) =>
		onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

	return (
		<div role="group" aria-label="Rôles" className="grid gap-2 sm:grid-cols-2">
			{roles.map((role) => {
				const checked = value.includes(role.id);
				return (
					<button
						key={role.id}
						type="button"
						role="checkbox"
						aria-checked={checked}
						disabled={disabled}
						onClick={() => toggle(role.id)}
						className={cn(
							"flex items-start gap-3 rounded-lg border p-3 text-start text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
							checked ? "border-primary bg-accent" : "hover:bg-muted",
						)}
					>
						<span
							className={cn(
								"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
								checked && "border-primary bg-primary text-primary-foreground",
							)}
						>
							{checked && <Check className="size-3" />}
						</span>
						<span className="grid gap-0.5">
							<span className="font-medium">{role.name}</span>
							{role.description && (
								<span className="text-muted-foreground text-xs">{role.description}</span>
							)}
						</span>
					</button>
				);
			})}
		</div>
	);
}
