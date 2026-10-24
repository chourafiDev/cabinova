"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PlatformRole } from "@/lib/platform-users";
import { cn } from "@/lib/utils";

/**
 * Role checkboxes. A role holding a permission the current user lacks is
 * disabled: the API refuses it anyway (no escalation).
 */
export function RolePicker({
	roles,
	value,
	onChange,
	myPermissions,
	invalid,
}: {
	roles: PlatformRole[];
	value: string[];
	onChange: (keys: string[]) => void;
	myPermissions: readonly string[];
	invalid?: boolean;
}) {
	return (
		<div role="group" data-invalid={invalid || undefined} className="grid gap-2">
			{roles.map((role) => {
				const beyond = role.permissions.some((p) => !myPermissions.includes(p));
				const checked = value.includes(role.key);
				const id = `role-${role.key}`;
				return (
					<label
						key={role.key}
						htmlFor={id}
						className={cn(
							"flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm",
							checked && "border-primary bg-primary/5",
							beyond && !checked && "cursor-not-allowed opacity-50",
						)}
					>
						<Checkbox
							id={id}
							className="mt-0.5"
							checked={checked}
							disabled={beyond && !checked}
							onCheckedChange={(v) => onChange(v ? [...value, role.key] : value.filter((k) => k !== role.key))}
						/>
						<span className="grid leading-tight">
							<span className="font-medium">{role.name}</span>
							<span className="text-xs text-muted-foreground">
								{role.description ?? `${role.permissions.length} permissions`}
								{beyond && " · au-delà de vos propres droits"}
							</span>
						</span>
					</label>
				);
			})}
		</div>
	);
}
