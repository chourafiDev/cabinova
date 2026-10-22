"use client";

import { Check, Info, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Permission } from "@/lib/permissions";
import {
	type MemberDetail,
	type Override,
	type PermissionInfo,
	RESOURCE_LABELS,
	type Role,
} from "@/lib/team";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../../_components/shared/unsaved-changes-bar";
import { RolePicker } from "../../_components/role-picker";

type Choice = "inherit" | "grant" | "deny";

const CHOICES: { value: Choice; label: string }[] = [
	{ value: "inherit", label: "Rôle" },
	{ value: "grant", label: "Autoriser" },
	{ value: "deny", label: "Refuser" },
];

const FORM_ID = "member-access";

/**
 * Roles + per-permission exceptions. Effective access = what the roles grant,
 * plus "Autoriser", minus "Refuser" (a refusal always wins).
 */
export function MemberAccessForm({
	member,
	roles,
	permissions,
	readOnlyReason,
}: {
	member: MemberDetail;
	roles: Role[];
	permissions: PermissionInfo[];
	readOnlyReason: string | null;
}) {
	const router = useRouter();
	const [, startRefresh] = useTransition();
	const initialRoles = member.roles.map((r) => r.id);
	const initialOverrides = Object.fromEntries(member.overrides.map((o) => [o.permission, o.effect]));
	const [roleIds, setRoleIds] = useState<string[]>(initialRoles);
	const [overrides, setOverrides] = useState<Partial<Record<Permission, Override["effect"]>>>(initialOverrides);
	const [saving, setSaving] = useState(false);
	const readOnly = !!readOnlyReason;

	/** Permissions granted by the selected roles, with the roles granting each. */
	const fromRoles = useMemo(() => {
		const map = new Map<Permission, string[]>();
		for (const role of roles.filter((r) => roleIds.includes(r.id))) {
			for (const p of role.permissions) map.set(p, [...(map.get(p) ?? []), role.name]);
		}
		return map;
	}, [roles, roleIds]);

	const groups = useMemo(() => {
		const order = Object.keys(RESOURCE_LABELS);
		const byResource = new Map<string, PermissionInfo[]>();
		for (const p of permissions) byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);
		return [...byResource.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
	}, [permissions]);

	const dirty =
		JSON.stringify([...roleIds].sort()) !== JSON.stringify([...initialRoles].sort()) ||
		JSON.stringify(sorted(overrides)) !== JSON.stringify(sorted(initialOverrides));

	function discard() {
		setRoleIds(initialRoles);
		setOverrides(initialOverrides);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			await api(`/users/${member.id}/access`, {
				method: "PUT",
				body: JSON.stringify({
					roleIds,
					overrides: Object.entries(overrides).map(([permission, effect]) => ({ permission, effect })),
				}),
			});
			toast.success("Accès mis à jour. Ils s'appliquent dès sa prochaine action.");
			startRefresh(() => router.refresh());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	}

	function setChoice(permission: Permission, choice: Choice) {
		setOverrides((current) => {
			const next = { ...current };
			if (choice === "inherit") delete next[permission];
			else next[permission] = choice;
			return next;
		});
	}

	return (
		<form id={FORM_ID} onSubmit={onSubmit} className="grid gap-3">
			{readOnlyReason && (
				<p className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
					<Info className="size-4 shrink-0" />
					{readOnlyReason}
				</p>
			)}

			<FormCard title="Rôles">
				<p className="text-muted-foreground mb-3 text-sm">
					Les rôles donnent les permissions par défaut. Ils sont définis par Cabinova.
				</p>
				<RolePicker roles={roles} value={roleIds} onChange={setRoleIds} disabled={readOnly} />
			</FormCard>

			<FormCard title="Permissions">
				<p className="text-muted-foreground mb-3 text-sm">
					Ajustez une permission pour ce membre uniquement : <strong>Autoriser</strong> l&apos;ajoute même si
					ses rôles ne la donnent pas, <strong>Refuser</strong> la retire même si un rôle la donne.
				</p>
				<div className="grid gap-4">
					{groups.map(([resource, items]) => (
						<section key={resource}>
							<h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
								{RESOURCE_LABELS[resource] ?? resource}
							</h3>
							<ul className="divide-y rounded-lg border">
								{items.map((p) => {
									const via = fromRoles.get(p.key);
									const choice: Choice = overrides[p.key] ?? "inherit";
									const effective = choice === "deny" ? false : choice === "grant" ? true : !!via;
									return (
										<li key={p.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
											<span
												className={cn(
													"flex size-6 shrink-0 items-center justify-center rounded-md",
													effective ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
												)}
												aria-label={effective ? "Autorisé" : "Non autorisé"}
											>
												{effective ? <Check className="size-3.5" /> : <X className="size-3.5" />}
											</span>
											<div className="grid min-w-0 flex-1 leading-tight">
												<span className="text-sm font-medium">{p.description ?? p.key}</span>
												<span className="text-muted-foreground text-xs">
													{via ? `Via ${via.join(", ")}` : "Aucun rôle ne la donne"}
												</span>
											</div>
											<div
												role="radiogroup"
												aria-label={p.description ?? p.key}
												className="bg-muted flex rounded-lg p-0.5"
											>
												{CHOICES.map((c) => (
													<button
														key={c.value}
														type="button"
														role="radio"
														aria-checked={choice === c.value}
														disabled={readOnly}
														onClick={() => setChoice(p.key, c.value)}
														className={cn(
															"rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed",
															choice === c.value
																? c.value === "deny"
																	? "bg-destructive text-white"
																	: c.value === "grant"
																		? "bg-primary text-primary-foreground"
																		: "bg-background shadow-sm"
																: "text-muted-foreground hover:text-foreground",
														)}
													>
														{c.label}
													</button>
												))}
											</div>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>
			</FormCard>

			<UnsavedChangesBar
				visible={dirty && !readOnly}
				label="Modifications non enregistrées"
				isSubmitting={saving}
				onDiscard={discard}
				formId={FORM_ID}
			/>
		</form>
	);
}

const sorted = (o: object) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
