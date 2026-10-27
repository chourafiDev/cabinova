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
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { can } from "@/lib/permissions";
import type { Branding } from "@/lib/settings";
import { useSessionStore } from "@/stores/session-store";
import { HelpCard } from "./help-card";
import { findNavItem, navGroups } from "./nav";

export function AppSidebar({ branding }: { branding: Branding }) {
	const pathname = usePathname();
	const active = findNavItem(pathname);
	const session = useSessionStore((s) => s.session);
	const permissions = session?.user.permissions;

	const groups = navGroups
		.map((group) => ({
			...group,
			items: group.items.filter((item) => !item.permission || can(permissions, item.permission)),
		}))
		.filter((group) => group.items.length > 0);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/" aria-label={`${branding.platformName} — tableau de bord`}>
								<BrandMark branding={branding} />
								<span className="truncate font-semibold">{branding.platformName}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{groups.map((group) => (
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
