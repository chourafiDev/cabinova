"use client";

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
import type { ClinicSession } from "@/lib/session";
import { HelpCard } from "./help-card";
import { SpaceSwitcher } from "./space-switcher";
import { findNavItem, navGroups } from "./nav";

export function AppSidebar({
	cabinet,
	spaces,
	isOwner,
}: {
	cabinet: ClinicSession["cabinet"];
	spaces: ClinicSession["spaces"];
	isOwner: boolean;
}) {
	const pathname = usePathname();
	const active = findNavItem(pathname);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				{spaces ? (
					<SpaceSwitcher cabinet={cabinet} spaces={spaces} isOwner={isOwner} />
				) : (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild>
								<Link href="/" aria-label={`${cabinet.name} — tableau de bord`}>
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
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={active?.href === item.href} tooltip={item.title}>
										<Link href={item.href}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
									{item.soon && (
										<SidebarMenuBadge className="text-[10px] font-normal text-muted-foreground">Bientôt</SidebarMenuBadge>
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
