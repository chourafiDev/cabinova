"use client";

import { Check, ChevronsUpDown, Loader, MapPin, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
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
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { api } from "@/lib/api-client";
import type { ClinicSession, Space } from "@/lib/session";
import { spaceLabel, switchSpace } from "@/lib/spaces";

const initial = (name: string) => name.replace(/^(cabinet|espace)\s+/i, "").charAt(0).toUpperCase();

/**
 * Top of the sidebar: the cabinet and the space you work in. Switching
 * reloads everything for the other space (patients, agenda…); the owner
 * also creates spaces here.
 */
export function SpaceSwitcher({
	cabinet,
	spaces,
	isOwner,
}: {
	cabinet: ClinicSession["cabinet"];
	spaces: NonNullable<ClinicSession["spaces"]>;
	isOwner: boolean;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const [pending, setPending] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const { current } = spaces;

	const choose = async (space: Space) => {
		if (space.id === current.id) return;
		setPending(space.id);
		try {
			const href = await switchSpace(space.id, pathname);
			toast.success(`Espace : ${space.name}`);
			router.push(href);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Changement impossible");
		} finally {
			setPending(null);
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent"
							aria-label={`${cabinet.name}, espace ${current.name} — changer d’espace`}
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
								{initial(cabinet.name)}
							</span>
							<span className="grid min-w-0 flex-1 leading-tight">
								<span className="truncate font-semibold">{cabinet.name}</span>
								<span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
									<MapPin className="shrink-0" />
									<span className="truncate">{spaceLabel(current)}</span>
								</span>
							</span>
							<ChevronsUpDown className="text-muted-foreground ms-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" sideOffset={6} className="w-64">
						<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Espaces</DropdownMenuLabel>
						{spaces.spaces.map((space) => (
							<DropdownMenuItem key={space.id} onSelect={() => choose(space)} className="gap-2">
								<p className="focus:**:text-brand text-brand bg-muted flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium">
									{initial(space.name)}
								</p>
								<span className="grid min-w-0 flex-1 leading-tight">
									<span className="truncate">{space.name}</span>
									{space.city && <span className="text-muted-foreground truncate text-xs">{space.city}</span>}
								</span>
								{pending === space.id ? (
									<Loader className="size-4 animate-spin" />
								) : (
									space.id === current.id && <Check className="size-4" />
								)}
							</DropdownMenuItem>
						))}
						{isOwner && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => setCreating(true)} className="gap-2">
									<span className="flex size-6 items-center justify-center rounded-md border border-dashed">
										<Plus className="size-3.5" />
									</span>
									Nouvel espace
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				{isOwner && <NewSpaceDialog open={creating} onOpenChange={setCreating} />}
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

/** Owner only: a new branch. Its patients, team and agenda start empty. */
function NewSpaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const router = useRouter();
	const [v, setV] = useState({ name: "", city: "", address: "", phone: "" });
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (v.name.trim().length < 2) return setError("Nom de l’espace : 2 caractères minimum.");
		setSaving(true);
		setError(null);
		try {
			await api("/spaces", { method: "POST", body: JSON.stringify(v) });
			toast.success(`Espace « ${v.name.trim()} » créé`);
			onOpenChange(false);
			setV({ name: "", city: "", address: "", phone: "" });
			router.push("/");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Création impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={save} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>Nouvel espace</DialogTitle>
						<DialogDescription>
							Un site du cabinet (ex. une autre ville). Ses patients, son équipe et son agenda sont séparés des autres
							espaces.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="gap-4">
						<Field>
							<FieldLabel htmlFor="space-name">Nom</FieldLabel>
							<Input
								id="space-name"
								autoFocus
								placeholder="Ex. Marrakech Guéliz"
								value={v.name}
								onChange={(e) => setV({ ...v, name: e.target.value })}
							/>
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="space-city">Ville</FieldLabel>
								<Input id="space-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
							</Field>
							<Field>
								<FieldLabel htmlFor="space-phone">Téléphone</FieldLabel>
								<Input
									id="space-phone"
									type="tel"
									value={v.phone}
									onChange={(e) => setV({ ...v, phone: e.target.value })}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor="space-address">Adresse</FieldLabel>
							<Input id="space-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
						</Field>
					</FieldGroup>
					{error && (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={saving}>
							{saving && <Loader className="animate-spin" />} Créer l’espace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
