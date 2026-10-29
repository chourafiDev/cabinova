"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	LuArchive,
	LuArchiveRestore,
	LuCalendarClock,
	LuClock,
	LuEllipsis,
	LuLoader,
	LuMapPin,
	LuPencil,
	LuPhone,
	LuPlus,
	LuUsers,
} from "react-icons/lu";
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
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { ManagedSpace } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";
import { SpaceDialog } from "./space-dialog";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Owner: the cabinet's spaces (sites), open ones first. */
export function SpacesManager({ spaces, currentId }: { spaces: ManagedSpace[]; currentId: string | null }) {
	const [editing, setEditing] = useState<ManagedSpace | "new" | null>(null);
	const [closing, setClosing] = useState<ManagedSpace | null>(null);
	const open = spaces.filter((s) => s.active);
	const closed = spaces.filter((s) => !s.active);

	return (
		<>
			<SettingsCard
				title="Espaces"
				description="Chaque espace est un site du cabinet (ex. une ville) : ses patients, son équipe et son agenda sont séparés des autres."
				action={
					<Button size="sm" onClick={() => setEditing("new")}>
						<LuPlus /> Nouvel espace
					</Button>
				}
			>
				<ul className="grid gap-3">
					{open.map((s) => (
						<SpaceRow
							key={s.id}
							space={s}
							current={s.id === currentId}
							canClose={open.length > 1}
							onEdit={() => setEditing(s)}
							onClose={() => setClosing(s)}
						/>
					))}
				</ul>
			</SettingsCard>

			{closed.length > 0 && (
				<SettingsCard
					title="Espaces fermés"
					description="Leurs données sont conservées. Rouvrez un espace pour que son équipe y retravaille."
				>
					<ul className="grid gap-3">
						{closed.map((s) => (
							<SpaceRow key={s.id} space={s} current={false} canClose={false} onEdit={() => setEditing(s)} />
						))}
					</ul>
				</SettingsCard>
			)}

			<SpaceDialog
				space={editing === "new" ? null : editing}
				open={editing !== null}
				onOpenChange={(o) => !o && setEditing(null)}
			/>
			<CloseSpaceDialog space={closing} onOpenChange={(o) => !o && setClosing(null)} />
		</>
	);
}

function SpaceRow({
	space: s,
	current,
	canClose,
	onEdit,
	onClose,
}: {
	space: ManagedSpace;
	current: boolean;
	canClose: boolean;
	onEdit: () => void;
	onClose?: () => void;
}) {
	const router = useRouter();
	const [reopening, setReopening] = useState(false);

	const reopen = async () => {
		setReopening(true);
		try {
			await api(`/spaces/${s.id}/reopen`, { method: "POST" });
			toast.success(`Espace « ${s.name} » rouvert`);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Réouverture impossible");
		} finally {
			setReopening(false);
		}
	};

	return (
		<li className={cn("flex items-start gap-3 rounded-lg border p-3", !s.active && "bg-muted/30")}>
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-lg",
					s.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
				)}
			>
				<LuMapPin className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium leading-tight">{s.name}</span>
					{current && (
						<Badge variant="outline" className="border-transparent bg-primary/10 font-normal text-primary">
							Espace actuel
						</Badge>
					)}
					{!s.active && (
						<Badge variant="outline" className="font-normal">
							Fermé
						</Badge>
					)}
				</div>
				{(s.city || s.address || s.phone) && (
					<p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
						{(s.address || s.city) && <span>{[s.address, s.city].filter(Boolean).join(", ")}</span>}
						{s.phone && (
							<span className="inline-flex items-center gap-1">
								<LuPhone className="size-3" /> {s.phone}
							</span>
						)}
					</p>
				)}
				<p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					<span className="inline-flex items-center gap-1">
						<LuUsers className="size-3" /> {plural(s.patients, "patient", "patients")}
					</span>
					<span className="inline-flex items-center gap-1">
						<LuCalendarClock className="size-3" /> {plural(s.upcomingAppointments, "RDV à venir", "RDV à venir")}
					</span>
				</p>
			</div>
			{s.active ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="size-8" aria-label={`Actions pour ${s.name}`}>
							<LuEllipsis />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-48">
						<DropdownMenuItem onSelect={onEdit}>
							<LuPencil /> Modifier
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href={`/settings/hours?espace=${s.id}`}>
								<LuClock /> Horaires d’ouverture
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							disabled={!canClose}
							onSelect={onClose}
							title={canClose ? undefined : "Le cabinet doit garder au moins un espace ouvert"}
						>
							<LuArchive /> Fermer l’espace
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<Button variant="outline" size="sm" disabled={reopening} onClick={reopen}>
					{reopening ? <LuLoader className="animate-spin" /> : <LuArchiveRestore />} Rouvrir
				</Button>
			)}
		</li>
	);
}

/** Closing keeps everything; nobody works in the space until it's reopened. */
function CloseSpaceDialog({ space, onOpenChange }: { space: ManagedSpace | null; onOpenChange: (open: boolean) => void }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	const close = async () => {
		if (!space) return;
		setPending(true);
		try {
			await api(`/spaces/${space.id}/close`, { method: "POST" });
			toast.success(`Espace « ${space.name} » fermé`);
			onOpenChange(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Fermeture impossible");
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={space !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Fermer « {space?.name} » ?</DialogTitle>
					<DialogDescription>
						Ses patients et rendez-vous sont conservés, mais plus personne ne pourra y travailler jusqu’à sa
						réouverture.
						{space && space.upcomingAppointments > 0 && (
							<span className="text-foreground mt-2 block font-medium">
								Attention : {plural(space.upcomingAppointments, "rendez-vous à venir", "rendez-vous à venir")} dans cet
								espace.
							</span>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
					<Button variant="destructive" disabled={pending} onClick={close}>
						{pending && <LuLoader className="animate-spin" />} Fermer l’espace
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
