"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LuCheck, LuLock, LuRotateCcw } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import {
	effectivePermissions,
	groupPermissions,
	type OverrideEffect,
	type PermissionInfo,
	type PlatformRole,
	type PlatformUserDetail,
} from "@/lib/platform-users";
import { cn } from "@/lib/utils";
import { FormCard } from "../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../_components/shared/unsaved-changes-bar";

const FORM_ID = "user-access-form";

const schema = z.object({
	name: z.string().trim().min(2, "Nom requis").max(120),
	roleKeys: z.array(z.string()).min(1, "Au moins un rôle"),
	overrides: z.record(z.string(), z.enum(["grant", "deny"])),
});
type AccessInput = z.infer<typeof schema>;

/** Drops exceptions that only repeat what the roles already give or withhold. */
const normalize = (overrides: Record<string, OverrideEffect>, fromRoles: Set<string>) =>
	Object.fromEntries(
		Object.entries(overrides).filter(([key, effect]) => (effect === "grant") !== fromRoles.has(key)),
	);

/**
 * Module 5 — a user's access: role(s) on the left, then one row per area
 * with "Consulter" / "Gérer" switches showing the effective result. A switch
 * that departs from what the roles give becomes a per-user exception
 * (marked, and resettable); putting it back removes the exception.
 */
export function AccessForm({
	user,
	roles,
	catalog,
	myPermissions,
	readOnly,
	isSelf,
	aside,
}: {
	user: PlatformUserDetail;
	roles: PlatformRole[];
	catalog: PermissionInfo[];
	myPermissions: string[];
	readOnly: boolean;
	/** Your own account: the role is locked (the API forbids self-demotion). */
	isSelf: boolean;
	/** Extra cards for the side column (sessions, history). */
	aside: React.ReactNode;
}) {
	const router = useRouter();
	const form = useForm<AccessInput>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: user.name,
			roleKeys: user.roles.map((r) => r.key),
			overrides: user.overrides as Record<string, OverrideEffect>,
		},
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const [roleKeys, overrides] = useWatch({ control: form.control, name: ["roleKeys", "overrides"] });
	const fromRoles = effectivePermissions(roles, roleKeys, {});
	const active = normalize(overrides, fromRoles);
	const effective = effectivePermissions(roles, roleKeys, active);
	const exceptionCount = Object.keys(active).length;

	const groups = groupPermissions(catalog);

	/** Sets one permission's effective state, recording an exception only if it differs from the roles. */
	const setPermission = (next: Record<string, OverrideEffect>, key: string, on: boolean) => {
		if (on === fromRoles.has(key)) delete next[key];
		else next[key] = on ? "grant" : "deny";
	};

	const toggle = (group: (typeof groups)[number], action: "read" | "write", on: boolean) => {
		const next = { ...active };
		const { read, write } = group;
		if (action === "write" && write) {
			setPermission(next, write.key, on);
			// Managing implies viewing.
			if (on && read && !effective.has(read.key) && myPermissions.includes(read.key)) setPermission(next, read.key, true);
		}
		if (action === "read" && read) {
			setPermission(next, read.key, on);
			if (!on && write && effective.has(write.key)) setPermission(next, write.key, false);
			if (!on) for (const extra of group.extras) if (effective.has(extra.key)) setPermission(next, extra.key, false);
		}
		form.setValue("overrides", next, { shouldDirty: true });
	};

	/** An extra permission (e.g. "Voir tous les tickets") implies Consulter. */
	const toggleExtra = (group: (typeof groups)[number], key: string, on: boolean) => {
		const next = { ...active };
		setPermission(next, key, on);
		const read = group.read;
		if (on && read && !effective.has(read.key) && myPermissions.includes(read.key)) setPermission(next, read.key, true);
		form.setValue("overrides", next, { shouldDirty: true });
	};

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const body = { ...values, overrides: normalize(values.overrides, fromRoles) };
			await api(`/platform-users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
			toast.success("Accès mis à jour");
			form.reset(body);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		}
	});

	const cell = (group: (typeof groups)[number], action: "read" | "write") => {
		const permission = group[action];
		if (!permission) return <span className="text-muted-foreground/40" aria-hidden>—</span>;
		const effect = active[permission.key];
		const locked = readOnly || (!myPermissions.includes(permission.key) && !effective.has(permission.key));
		return (
			<span className="inline-flex flex-col items-center gap-1">
				<span className="inline-flex items-center gap-1.5">
					{!readOnly && !myPermissions.includes(permission.key) && (
						<LuLock className="size-3 text-muted-foreground" aria-label="Vous n’avez pas cette permission" />
					)}
					<Switch
						checked={effective.has(permission.key)}
						disabled={locked}
						onCheckedChange={(on) => toggle(group, action, on)}
						aria-label={`${permission.description} (${group.label})`}
					/>
				</span>
				{effect && (
					<span
						className={cn(
							"rounded px-1 text-[10px] font-medium leading-4",
							effect === "grant" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
						)}
					>
						{effect === "grant" ? "Ajoutée" : "Retirée"}
					</span>
				)}
			</span>
		);
	};

	return (
		<form id={FORM_ID} onSubmit={onSubmit} noValidate className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
			<div className="grid gap-3">
				<FormCard title="Rôle">
					<Controller
						control={form.control}
						name="roleKeys"
						render={({ field }) => (
							<div role="radiogroup" aria-label="Rôle" className="grid gap-2 sm:grid-cols-3">
								{roles.map((role) => {
									const checked = field.value.includes(role.key);
									const beyond = role.permissions.some((p) => !myPermissions.includes(p));
									return (
										<button
											key={role.key}
											type="button"
											role="radio"
											aria-checked={checked}
											disabled={readOnly || isSelf || (beyond && !checked)}
											onClick={() => field.onChange([role.key])}
											className={cn(
												"relative grid gap-0.5 rounded-lg border p-3 text-start text-sm transition-colors enabled:hover:bg-muted/50 disabled:cursor-not-allowed",
												checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "disabled:opacity-50",
											)}
										>
											{checked && <LuCheck className="absolute end-2.5 top-2.5 size-4 text-primary" aria-hidden />}
											<span className="pe-5 font-medium">{role.name}</span>
											<span className="text-xs text-muted-foreground">{role.permissions.length} permissions</span>
										</button>
									);
								})}
							</div>
						)}
					/>
					{isSelf && !readOnly && (
						<p className="mt-2 text-xs text-muted-foreground">
							Vous ne pouvez pas changer votre propre rôle : demandez à un autre Super Admin.
						</p>
					)}
					<FieldError errors={[errors.roleKeys]} />
				</FormCard>

				<FormCard
					title={
						<span className="flex items-center gap-2">
							Permissions
							<Badge variant="secondary" className="tabular-nums">
								{effective.size} / {catalog.length}
							</Badge>
							{exceptionCount > 0 && (
								<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
									{exceptionCount} exception{exceptionCount > 1 ? "s" : ""}
								</Badge>
							)}
						</span>
					}
					action={
						exceptionCount > 0 &&
						!readOnly && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => form.setValue("overrides", {}, { shouldDirty: true })}
							>
								<LuRotateCcw /> Revenir au rôle
							</Button>
						)
					}
				>
					<p className="mb-2 text-xs text-muted-foreground">
						Hérité du rôle. Changez un interrupteur pour créer une exception pour cet utilisateur seulement.
					</p>
					<div className="grid grid-cols-[1fr_80px_80px] border-b pb-2 text-xs font-medium text-muted-foreground">
						<span>Domaine</span>
						<span className="text-center">Consulter</span>
						<span className="text-center">Gérer</span>
					</div>
					<ul className="divide-y">
						{groups.map((group) => {
							const on =
								(group.read && effective.has(group.read.key)) || (group.write && effective.has(group.write.key));
							return (
								<li key={group.resource} className="grid grid-cols-[1fr_80px_80px] items-center py-2.5">
									<div className="grid min-w-0 gap-0.5 pe-3">
										<span className={cn("text-sm font-medium", !on && "text-muted-foreground")}>{group.label}</span>
										<span className="truncate text-xs text-muted-foreground">
											{(group.write ?? group.read)?.description}
										</span>
									</div>
									<div className="flex justify-center">{cell(group, "read")}</div>
									<div className="flex justify-center">{cell(group, "write")}</div>
									{group.extras.map((extra) => {
										const effect = active[extra.key];
										const locked = readOnly || (!myPermissions.includes(extra.key) && !effective.has(extra.key));
										return (
											<label
												key={extra.key}
												className="col-span-3 mt-1.5 flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-1.5"
											>
												<span className="flex flex-wrap items-center gap-1.5 text-xs">
													{extra.description}
													{effect && (
														<span
															className={cn(
																"rounded px-1 text-[10px] font-medium leading-4",
																effect === "grant" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
															)}
														>
															{effect === "grant" ? "Ajoutée" : "Retirée"}
														</span>
													)}
												</span>
												<span className="inline-flex items-center gap-1.5">
													{!readOnly && !myPermissions.includes(extra.key) && (
														<LuLock className="size-3 text-muted-foreground" aria-label="Vous n’avez pas cette permission" />
													)}
													<Switch
														checked={effective.has(extra.key)}
														disabled={locked}
														onCheckedChange={(on) => toggleExtra(group, extra.key, on)}
														aria-label={`${extra.description} (${group.label})`}
													/>
												</span>
											</label>
										);
									})}
									</li>
							);
						})}
					</ul>
				</FormCard>
			</div>

			<div className="grid gap-3">
				<FormCard title="Profil">
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Nom</FieldLabel>
						<Input id="name" disabled={readOnly} aria-invalid={!!errors.name} {...form.register("name")} />
						<FieldError errors={[errors.name]} />
					</Field>
					<Field className="mt-3">
						<FieldLabel htmlFor="email">E-mail</FieldLabel>
						<Input id="email" value={user.email} disabled readOnly />
						<FieldDescription>Identifiant de connexion, non modifiable.</FieldDescription>
					</Field>
				</FormCard>
				{aside}
			</div>

			<UnsavedChangesBar
				visible={isDirty && !isSubmitting}
				label="Accès modifiés, non enregistrés"
				isSubmitting={isSubmitting}
				onDiscard={() => form.reset()}
				formId={FORM_ID}
			/>
		</form>
	);
}
