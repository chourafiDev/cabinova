"use client";

import {
	LuBuilding2,
	LuCheck,
	LuChevronsUpDown,
	LuClock,
	LuLoader,
	LuMapPin,
	LuPlus,
	LuSettings,
	LuTags,
	LuUsers,
} from "react-icons/lu";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { SubscriptionDialog } from "./billing/subscription-dialog";

const initial = (name: string) => name.replace(/^(cabinet|espace)\s+/i, "").charAt(0).toUpperCase();

const MANAGE = [
	{ href: "/settings/cabinet", label: "Le cabinet", icon: LuBuilding2 },
	{ href: "/settings/hours", label: "Horaires d’ouverture", icon: LuClock },
	{ href: "/settings/tarifs", label: "Tarifs", icon: LuTags },
	{ href: "/settings/spaces", label: "Espaces", icon: LuMapPin },
];

const STATUS = { trialing: "Essai gratuit", past_due: "En attente de paiement" } as const;

/**
 * Top of the sidebar: the cabinet and the space you work in, its offer, and
 * the way to the cabinet's settings. Switching reloads everything for the
 * other space (patients, agenda…); the owner also creates spaces here.
 */
export function SpaceSwitcher({
	cabinet,
	spaces,
	subscription,
	isOwner,
}: {
	cabinet: ClinicSession["cabinet"];
	spaces: NonNullable<ClinicSession["spaces"]>;
	subscription: ClinicSession["subscription"];
	isOwner: boolean;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const [pending, setPending] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [billing, setBilling] = useState(false);
	const { current } = spaces;
	// Staff don't see the cabinet's billing: what the cabinet is, instead.
	const offerLine = isOwner
		? [subscription.plan ? `Offre ${subscription.plan}` : "Aucune offre", STATUS[subscription.status as keyof typeof STATUS]]
				.filter(Boolean)
				.join(" · ")
		: (cabinet.specialty ?? cabinet.city ?? `${cabinet.subdomain}.cabinova.ma`);

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
								<p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
									<LuMapPin className="!size-3 shrink-0" />
									<span className="truncate">{spaceLabel(current)}</span>
								</p>
							</span>
							<LuChevronsUpDown className="text-muted-foreground ms-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" sideOffset={6} className="w-80 p-2">
						<div className="flex items-center gap-3 p-2">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
								{initial(cabinet.name)}
							</span>
							<div className="grid min-w-0 flex-1 gap-0.5">
								<p className="truncate font-semibold">{cabinet.name}</p>
								<div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
									<span className="truncate">{offerLine}</span>
									{isOwner && (
										<>
											<span aria-hidden>·</span>
											<DropdownMenuItem
												onSelect={() => setBilling(true)}
												className="text-muted-foreground w-fit shrink-0 rounded-sm p-1 text-xs underline underline-offset-2 focus:text-brand focus:bg-transparent"
											>
												{subscription.quotePending
													? "Voir mon devis"
													: subscription.status === "trialing"
														? "Choisir mon offre"
														: "Gérer"}
											</DropdownMenuItem>
										</>
									)}
								</div>
							</div>
						</div>

						<div className={cn("grid gap-2 px-2 pt-1 pb-3", isOwner && "grid-cols-2")}>
							<DropdownMenuItem asChild className="h-9 justify-center gap-2 rounded-lg border">
								<Link href="/settings">
									<LuSettings className="size-4" /> Paramètres
								</Link>
							</DropdownMenuItem>
							{isOwner && (
								<DropdownMenuItem asChild className="h-9 justify-center gap-2 rounded-lg border">
									<Link href="/staff">
										<LuUsers className="size-4" /> Équipe
									</Link>
								</DropdownMenuItem>
							)}
						</div>

						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground px-2 text-xs font-normal">Espaces</DropdownMenuLabel>
						{spaces.spaces.map((space) => (
							<DropdownMenuItem key={space.id} onSelect={() => choose(space)} className="gap-2">
								<p className="!text-brand text-brand bg-muted flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium">
									{initial(space.name)}
								</p>
								<span className="grid min-w-0 flex-1 leading-tight">
									<span className="truncate">{space.name}</span>
									{space.city && <span className="text-muted-foreground truncate text-xs">{space.city}</span>}
								</span>
								{pending === space.id ? (
									<LuLoader className="size-4 animate-spin" />
								) : (
									space.id === current.id && <LuCheck className="size-4" />
								)}
							</DropdownMenuItem>
						))}

						{isOwner && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-muted-foreground px-2 text-xs font-normal">Gérer</DropdownMenuLabel>
								{MANAGE.map((item) => (
									<DropdownMenuItem key={item.href} asChild className="gap-2.5">
										<Link href={item.href}>
											<item.icon className="text-muted-foreground size-4" /> {item.label}
										</Link>
									</DropdownMenuItem>
								))}
								<div className="px-2 pt-2 pb-1">
									<DropdownMenuItem
										onSelect={() => setCreating(true)}
										className="h-9 justify-center gap-2 rounded-lg border"
									>
										<LuPlus className="size-4" /> Nouvel espace
									</DropdownMenuItem>
								</div>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				{isOwner && <NewSpaceDialog open={creating} onOpenChange={setCreating} />}
				{isOwner && <SubscriptionDialog open={billing} onOpenChange={setBilling} />}
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
							{saving && <LuLoader className="animate-spin" />} Créer l’espace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
