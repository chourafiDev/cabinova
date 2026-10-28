import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getClinicState } from "@/lib/session";
import { AppSidebar } from "./_components/app-sidebar";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

/** The cabinet comes from the subdomain (clinic-api); every page needs a session. */
export default async function ClinicLayout({ children }: LayoutProps<"/">) {
  const state = await getClinicState();
  if (state.status === "unavailable") return <CabinetUnavailable reason={state.reason} />;
  if (state.status === "signed-out") redirect("/login");
  const { session } = state;
  // Remember whether the sidebar was collapsed (cookie set by the sidebar).
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar cabinet={session.cabinet} />
      {/* Inset panel: fixed frame on desktop, the page scrolls inside it. */}
      <SidebarInset className="min-w-0 md:h-[calc(100svh-1rem)] md:overflow-y-auto md:border md:border-black/5">
        <SiteHeader user={session.user} />
        <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
        <SiteFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
