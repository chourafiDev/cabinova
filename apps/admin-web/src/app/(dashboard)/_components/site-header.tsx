"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "./global-search";
import { findNavItem } from "./nav";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  const pathname = usePathname();
  const title =
    findNavItem(pathname)?.title ?? (pathname.startsWith("/account") ? "Mon compte" : "Tableau de bord");

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:rounded-t-xl">
      <SidebarTrigger className="-ms-1" />
      <Separator orientation="vertical" className="me-2 my-auto data-[orientation=vertical]:h-6" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ms-auto flex flex-1 items-center justify-end gap-2">
        <GlobalSearch />
        <ThemeToggle />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
