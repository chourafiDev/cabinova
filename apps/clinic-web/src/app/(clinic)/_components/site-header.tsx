"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ClinicSession } from "@/lib/session";
import { CommandPalette } from "./command-palette";
import { findNavItem } from "./nav";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { MeetingButton } from "@/components/meetings/meeting-button";
import { UserMenu } from "./user-menu";

export function SiteHeader({ user, spaces }: { user: ClinicSession["user"]; spaces: ClinicSession["spaces"] }) {
  const pathname = usePathname();
  const t = useTranslations("nav.items");
  const common = useTranslations("common");
  const title = t(findNavItem(pathname)?.key ?? "dashboard");

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:rounded-t-xl">
      <SidebarTrigger className="-ms-1" />
      <Separator orientation="vertical" className="me-2 my-auto data-[orientation=vertical]:h-6" />
      <Breadcrumb aria-label={common("breadcrumb")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ms-auto flex flex-1 items-center justify-end gap-2">
        <CommandPalette spaces={spaces} role={user.role} />
        {user.role === "owner" && <MeetingButton />}
        <NotificationBell />
        <span data-tour="account" className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </span>
      </div>
    </header>
  );
}
