"use client";

import { Info, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { groupPermissions, type PermissionInfo, type PlatformRole } from "@/lib/platform-users";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

/**
 * Adjust what Agent de Support or Agent technique can do (the role set
 * itself is fixed). One row per area with "Consulter" and "Gérer" side by
 * side: managing implies viewing, so turning on Gérer turns on Consulter and
 * turning off Consulter turns off Gérer. Permissions you don't hold are
 * locked — the API refuses them anyway.
 */
export function RoleDialog({
	role,
	catalog,
	myPermissions,
	children,
}: {
	role: PlatformRole;
	catalog: PermissionInfo[];
	myPermissions: string[];
	children: React.ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
	const [saving, setSaving] = useState(false);

	const groups = groupPermissions(catalog).map((g) => ({
		...g,
		read: g.permissions.find((p) => p.action === "read"),
		write: g.permissions.find((p) => p.action === "write"),
	}));
	const initial = new Set(role.permissions);
	const changes = catalog.filter((p) => selected.has(p.key) !== initial.has(p.key)).length;

	const toggle = (group: (typeof groups)[number], action: "read" | "write", on: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			const { read, write } = group;
			if (action === "write" && write) {
				if (on) {
					next.add(write.key);
					if (read && myPermissions.includes(read.key)) next.add(read.key);
				} else next.delete(write.key);
			}
			if (action === "read" && read) {
				if (on) next.add(read.key);
				else {
					next.delete(read.key);
					if (write) next.delete(write.key);
				}
			}
			return next;
		});

	const save = async () => {
		setSaving(true);
		try {
			await api(`/platform-roles/${role.id}`, {
				method: "PATCH",
				body: JSON.stringify({ permissions: [...selected] }),
			});
			toast.success(`Permissions de ${role.name} mises à jour`);
			setOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	const cell = (group: (typeof groups)[number], action: "read" | "write") => {
		const permission = group[action];
		if (!permission) return <span className="text-muted-foreground/40" aria-hidden>—</span>;
		const locked = !myPermissions.includes(permission.key);
		return (
			<span className="inline-flex items-center gap-1.5" title={locked ? "Vous n’avez pas cette permission" : permission.description}>
				{locked && <Lock className="size-3 text-muted-foreground" aria-hidden />}
				<Switch
					checked={selected.has(permission.key)}
					disabled={locked}
					onCheckedChange={(on) => toggle(group, action, on)}
					aria-label={`${permission.description} (${group.label})`}
				/>
			</span>
		);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setSelected(new Set(role.permissions));
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
				<DialogHeader className="flex-row items-start gap-3 border-b px-5 pt-5 pb-4 text-start">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<ShieldCheck className="size-4" />
					</span>
					<div className="grid min-w-0 gap-1">
						<DialogTitle>{role.name}</DialogTitle>
						<DialogDescription>{role.description ?? "Permissions du rôle"}</DialogDescription>
						<div className="mt-1 flex flex-wrap gap-1.5">
							<Badge variant="secondary" className="tabular-nums">
								{selected.size} / {catalog.length} permissions
							</Badge>
							<Badge variant="outline">{plural(role.userCount, "utilisateur")}</Badge>
						</div>
					</div>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
					<div className="grid grid-cols-[1fr_88px_88px] items-center border-b pb-2 text-xs font-medium text-muted-foreground">
						<span>Domaine</span>
						<span className="text-center">Consulter</span>
						<span className="text-center">Gérer</span>
					</div>
					<ul className="divide-y">
						{groups.map((group) => {
							const on = (group.read && selected.has(group.read.key)) || (group.write && selected.has(group.write.key));
							return (
								<li key={group.resource} className="grid grid-cols-[1fr_88px_88px] items-center gap-y-0.5 py-3">
									<div className="grid min-w-0 gap-0.5 pe-3">
										<span className={cn("text-sm font-medium", !on && "text-muted-foreground")}>{group.label}</span>
										<span className="text-xs text-muted-foreground">
											{(group.write ?? group.read)?.description}
										</span>
									</div>
									<div className="flex justify-center">{cell(group, "read")}</div>
									<div className="flex justify-center">{cell(group, "write")}</div>
								</li>
							);
						})}
					</ul>
				</div>

				{role.userCount > 0 && (
					<p className="flex items-center gap-2 border-t bg-amber-50 px-5 py-2 text-xs text-amber-900">
						<Info className="size-3.5 shrink-0" />
						Les changements s’appliquent immédiatement à {plural(role.userCount, "utilisateur")}.
					</p>
				)}

				<DialogFooter className="m-0 items-center rounded-none px-5 py-3 sm:justify-between">
					<span className="text-xs text-muted-foreground">
						{changes ? plural(changes, "modification non enregistrée", "modifications non enregistrées") : "Gérer inclut Consulter."}
					</span>
					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Annuler
						</Button>
						<Button onClick={save} disabled={saving || changes === 0}>
							Enregistrer
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
