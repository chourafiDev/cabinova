"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MeetingButton } from "@/components/meetings/meeting-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ClinicSession } from "@/lib/session";
import { ChatHeaderButton } from "./chat-header-button";
import { CommandPalette } from "./command-palette";
import { findNavItem } from "./nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { VisitChips } from "./visit-chips";

export function SiteHeader({
	user,
	spaces,
}: {
	user: ClinicSession["user"];
	spaces: ClinicSession["spaces"];
}) {
	const pathname = usePathname();
	const t = useTranslations("nav.items");
	const common = useTranslations("common");
	const title = t(findNavItem(pathname, useSearchParams())?.key ?? "dashboard");

	return (
		<header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:rounded-t-xl">
			<SidebarTrigger className="-ms-1" />
			<Separator
				orientation="vertical"
				className="me-2 my-auto data-[orientation=vertical]:h-6"
			/>
			<Breadcrumb aria-label={common("breadcrumb")}>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="ms-auto flex flex-1 items-center justify-end gap-2">
				<div className="flex items-center gap-2 mr-4">
					{user.role === "owner" && <MeetingButton />}
					<ChatHeaderButton />
					<VisitChips />
				</div>
				<CommandPalette spaces={spaces} role={user.role} />
				<NotificationBell />
				<span data-tour="account" className="flex items-center gap-2">
					<ThemeToggle />
					<UserMenu user={user} />
				</span>
			</div>
		</header>
	);
}
