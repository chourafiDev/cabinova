"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { directionOf } from "@/i18n/config";
import type { ClinicSession } from "@/lib/session";
import { HelpCard } from "./help-card";
import { SpaceSwitcher } from "./space-switcher";
import { findNavItem, navGroups, visibleNavItems } from "./nav";

export function AppSidebar({
	cabinet,
	spaces,
	subscription,
	role,
}: {
	cabinet: ClinicSession["cabinet"];
	spaces: ClinicSession["spaces"];
	subscription: ClinicSession["subscription"];
	role: string;
}) {
	const isOwner = role === "owner";
	const pathname = usePathname();
	const active = findNavItem(pathname);
	const t = useTranslations("nav");
	const tc = useTranslations("common");

	return (
		<Sidebar collapsible="icon" variant="inset" side={directionOf(useLocale()) === "rtl" ? "right" : "left"}>
			<SidebarHeader>
				{spaces ? (
					<SpaceSwitcher cabinet={cabinet} spaces={spaces} subscription={subscription} isOwner={isOwner} />
				) : (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild>
								<Link href="/" aria-label={t("home", { cabinet: cabinet.name })}>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
										{cabinet.name.replace(/^cabinet\s+/i, "").charAt(0).toUpperCase()}
									</span>
									<span className="grid min-w-0 leading-tight">
										<span className="truncate font-semibold">{cabinet.name}</span>
										<span className="truncate text-xs text-muted-foreground">
											{cabinet.specialty ?? cabinet.city ?? `${cabinet.subdomain}.cabinova.ma`}
										</span>
									</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</SidebarHeader>

			<SidebarContent data-tour="nav">
				{navGroups.map((group) => (
					<SidebarGroup key={group.key}>
						<SidebarGroupLabel>{t(`groups.${group.key}`)}</SidebarGroupLabel>
						<SidebarMenu>
							{visibleNavItems(group.items, role).map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={active?.href === item.href} tooltip={t(`items.${item.key}`)}>
										<Link href={item.href}>
											<item.icon />
											<span>{t(`items.${item.key}`)}</span>
										</Link>
									</SidebarMenuButton>
									{item.soon && (
										<SidebarMenuBadge className="text-[10px] font-normal text-muted-foreground">{tc("soon")}</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<HelpCard />
			</SidebarFooter>
		</Sidebar>
	);
}
