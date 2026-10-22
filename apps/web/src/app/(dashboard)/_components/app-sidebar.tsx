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
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { HelpCard } from "./help-card";
import { findNavItem, navGroups } from "./nav";

export function AppSidebar() {
	const pathname = usePathname();
	const active = findNavItem(pathname);
	const session = useSessionStore((s) => s.session);
	const permissions = session?.user.permissions;
	const tenant = session?.tenant ?? { name: "Cabinova", logoUrl: null };

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
							<Link href="/" aria-label={`${tenant.name} — tableau de bord`}>
								<div
									className={cn(
										"flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground",
										tenant.logoUrl && "hidden group-data-[collapsible=icon]:flex",
									)}
								>
									{tenant.name.trim().charAt(0).toUpperCase() || "C"}
								</div>
								{tenant.logoUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={tenant.logoUrl}
										alt={tenant.name}
										className="h-10 mx-auto w-auto max-w-full object-contain object-left group-data-[collapsible=icon]:hidden"
									/>
								) : (
									<span className="truncate font-semibold">{tenant.name}</span>
								)}
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
