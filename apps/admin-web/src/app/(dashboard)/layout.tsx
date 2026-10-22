import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession } from "@/lib/session";
import { AppSidebar } from "./_components/app-sidebar";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Remember whether the sidebar was collapsed (cookie set by the sidebar).
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SessionProvider session={session}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        {/* min-w-0 lets wide content (tables) scroll inside instead of widening the page */}
        {/* Inset panel: fixed frame on desktop, the page scrolls inside it. */}
        <SidebarInset className="min-w-0 md:h-[calc(100svh-1rem)] md:overflow-y-auto md:border md:border-black/5">
          <SiteHeader />
          <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
          <SiteFooter />
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
