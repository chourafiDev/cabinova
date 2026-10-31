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
import { useTranslations } from "next-intl";
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
	{ href: "/settings/cabinet", label: "cabinet", icon: LuBuilding2 },
	{ href: "/settings/hours", label: "hours", icon: LuClock },
	{ href: "/settings/tarifs", label: "tarifs", icon: LuTags },
	{ href: "/settings/spaces", label: "spacesLink", icon: LuMapPin },
];

const STATUS = { trialing: "trialing", past_due: "pastDue" } as const;

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
	const t = useTranslations("common.space");
	const { current } = spaces;
	const status = STATUS[subscription.status as keyof typeof STATUS];
	// Staff don't see the cabinet's billing: what the cabinet is, instead.
	const offerLine = isOwner
		? [subscription.plan ? t("offer", { plan: subscription.plan }) : t("noOffer"), status && t(status)]
				.filter(Boolean)
				.join(" · ")
		: (cabinet.specialty ?? cabinet.city ?? `${cabinet.subdomain}.cabinova.ma`);

	const choose = async (space: Space) => {
		if (space.id === current.id) return;
		setPending(space.id);
		try {
			const href = await switchSpace(space.id, pathname);
			toast.success(t("changed", { space: space.name }));
			router.push(href);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("switchError"));
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
							aria-label={t("switch", { cabinet: cabinet.name, space: current.name })}
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
													? t("seeQuote")
													: subscription.status === "trialing"
														? t("chooseOffer")
														: t("manage")}
											</DropdownMenuItem>
										</>
									)}
								</div>
							</div>
						</div>

						<div className={cn("grid gap-2 px-2 pt-1 pb-3", isOwner && "grid-cols-2")}>
							<DropdownMenuItem asChild className="h-9 justify-center gap-2 rounded-lg border">
								<Link href="/settings">
									<LuSettings className="size-4" /> {t("settings")}
								</Link>
							</DropdownMenuItem>
							{isOwner && (
								<DropdownMenuItem asChild className="h-9 justify-center gap-2 rounded-lg border">
									<Link href="/staff">
										<LuUsers className="size-4" /> {t("team")}
									</Link>
								</DropdownMenuItem>
							)}
						</div>

						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground px-2 text-xs font-normal">{t("spaces")}</DropdownMenuLabel>
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
								<DropdownMenuLabel className="text-muted-foreground px-2 text-xs font-normal">{t("manageTitle")}</DropdownMenuLabel>
								{MANAGE.map((item) => (
									<DropdownMenuItem key={item.href} asChild className="gap-2.5">
										<Link href={item.href}>
											<item.icon className="text-muted-foreground size-4" /> {t(item.label)}
										</Link>
									</DropdownMenuItem>
								))}
								<div className="px-2 pt-2 pb-1">
									<DropdownMenuItem
										onSelect={() => setCreating(true)}
										className="h-9 justify-center gap-2 rounded-lg border"
									>
										<LuPlus className="size-4" /> {t("new")}
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
	const t = useTranslations("common.space");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (v.name.trim().length < 2) return setError(t("nameError"));
		setSaving(true);
		setError(null);
		try {
			await api("/spaces", { method: "POST", body: JSON.stringify(v) });
			toast.success(t("created", { name: v.name.trim() }));
			onOpenChange(false);
			setV({ name: "", city: "", address: "", phone: "" });
			router.push("/");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : t("createError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={save} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>{t("new")}</DialogTitle>
						<DialogDescription>
							{t("newDescription")}
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="gap-4">
						<Field>
							<FieldLabel htmlFor="space-name">{t("name")}</FieldLabel>
							<Input
								id="space-name"
								autoFocus
								placeholder={t("namePlaceholder")}
								value={v.name}
								onChange={(e) => setV({ ...v, name: e.target.value })}
							/>
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="space-city">{t("city")}</FieldLabel>
								<Input id="space-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
							</Field>
							<Field>
								<FieldLabel htmlFor="space-phone">{t("phone")}</FieldLabel>
								<Input
									id="space-phone"
									type="tel"
									value={v.phone}
									onChange={(e) => setV({ ...v, phone: e.target.value })}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor="space-address">{t("address")}</FieldLabel>
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
							{t("cancel")}
						</Button>
						<Button type="submit" disabled={saving}>
							{saving && <LuLoader className="animate-spin" />} {t("create")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
