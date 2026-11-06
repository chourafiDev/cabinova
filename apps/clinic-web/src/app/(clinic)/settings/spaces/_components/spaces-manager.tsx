"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	IconArchive,
	IconCalendarClock,
	IconCall,
	IconClock,
	IconEdit,
	IconLocation,
	IconMore,
	IconPlus,
	IconRestore,
	IconSpinner,
	IconUsers,
} from "@/components/icons";
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
import { formatPhone } from "@/lib/patients";
import type { ManagedSpace } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";
import { SpaceDialog } from "./space-dialog";

/** Owner: the cabinet's spaces (sites), open ones first. */
export function SpacesManager({ spaces, currentId }: { spaces: ManagedSpace[]; currentId: string | null }) {
	const [editing, setEditing] = useState<ManagedSpace | "new" | null>(null);
	const [closing, setClosing] = useState<ManagedSpace | null>(null);
	const t = useTranslations("settings.spaces");
	const open = spaces.filter((s) => s.active);
	const closed = spaces.filter((s) => !s.active);

	return (
		<>
			<SettingsCard
				title={t("title")}
				description={t("description")}
				action={
					<Button size="sm" onClick={() => setEditing("new")}>
						<IconPlus /> {t("newTitle")}
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
					title={t("closedTitle")}
					description={t("closedHint")}
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
	const t = useTranslations("settings.spaces");
	const common = useTranslations("settings.common");

	const reopen = async () => {
		setReopening(true);
		try {
			await api(`/spaces/${s.id}/reopen`, { method: "POST" });
			toast.success(t("reopened", { name: s.name }));
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("reopenError"));
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
				<IconLocation className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium leading-tight">{s.name}</span>
					{current && (
						<Badge variant="outline" className="border-transparent bg-primary/10 font-normal text-primary">
							{t("current")}
						</Badge>
					)}
					{!s.active && (
						<Badge variant="outline" className="font-normal">
							{common("closed")}
						</Badge>
					)}
				</div>
				{(s.city || s.address || s.phone) && (
					<p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
						{(s.address || s.city) && <span>{[s.address, s.city].filter(Boolean).join(", ")}</span>}
						{s.phone && (
							<span className="inline-flex items-center gap-1">
								<IconCall className="size-3" /> {formatPhone(s.phone)}
							</span>
						)}
					</p>
				)}
				<p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					<span className="inline-flex items-center gap-1">
						<IconUsers className="size-3" /> {t("patients", { count: s.patients })}
					</span>
					<span className="inline-flex items-center gap-1">
						<IconCalendarClock className="size-3" /> {t("upcoming", { count: s.upcomingAppointments })}
					</span>
				</p>
			</div>
			{s.active ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="size-8" aria-label={t("actionsFor", { name: s.name })}>
							<IconMore />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-48">
						<DropdownMenuItem onSelect={onEdit}>
							<IconEdit /> {common("edit")}
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href={`/settings/hours?espace=${s.id}`}>
								<IconClock /> {t("hours")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							disabled={!canClose}
							onSelect={onClose}
							title={canClose ? undefined : t("keepOne")}
						>
							<IconArchive /> {t("close")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<Button variant="outline" size="sm" disabled={reopening} onClick={reopen}>
					{reopening ? <IconSpinner className="animate-spin" /> : <IconRestore />} {t("reopen")}
				</Button>
			)}
		</li>
	);
}

/** Closing keeps everything; nobody works in the space until it's reopened. */
function CloseSpaceDialog({ space, onOpenChange }: { space: ManagedSpace | null; onOpenChange: (open: boolean) => void }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const t = useTranslations("settings.spaces");
	const common = useTranslations("settings.common");

	const close = async () => {
		if (!space) return;
		setPending(true);
		try {
			await api(`/spaces/${space.id}/close`, { method: "POST" });
			toast.success(t("closed", { name: space.name }));
			onOpenChange(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("closeError"));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={space !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("closeTitle", { name: space?.name ?? "" })}</DialogTitle>
					<DialogDescription>
						{t("closeHint")}
						{space && space.upcomingAppointments > 0 && (
							<span className="text-foreground mt-2 block font-medium">
								{t("closeWarning", { count: space.upcomingAppointments })}
							</span>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{common("cancel")}
					</Button>
					<Button variant="destructive" disabled={pending} onClick={close}>
						{pending && <IconSpinner className="animate-spin" />} {t("close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
