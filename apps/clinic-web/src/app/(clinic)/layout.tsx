import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BANNER_COOKIE, bannerDismissKey, billingNotice } from "@/lib/billing-notice";
import { getClinicState } from "@/lib/session";
import { Suspense } from "react";
import { BillingBanner } from "./_components/billing/billing-banner";
import { ProductTour } from "./_components/tour/product-tour";
import { AppSidebar } from "./_components/app-sidebar";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

/** The cabinet comes from the subdomain (clinic-api); every page needs a session. */
export default async function ClinicLayout({ children }: LayoutProps<"/">) {
  const state = await getClinicState();
  if (state.status === "unavailable") return <CabinetUnavailable reason={state.reason} />;
  if (state.status === "signed-out") redirect("/login");
  const { session } = state;
  const cookieStore = await cookies();
  // Remember whether the sidebar was collapsed (cookie set by the sidebar).
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const now = new Date();
  const notice = billingNotice(session, now);
  const dismissKey = notice && bannerDismissKey(notice, now);
  const showBanner =
    notice && dismissKey && (notice.kind === "past-due" || cookieStore.get(BANNER_COOKIE)?.value !== dismissKey);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar cabinet={session.cabinet} />
      {/* Inset panel: fixed frame on desktop, the page scrolls inside it. */}
      <SidebarInset className="min-w-0 md:h-[calc(100svh-1rem)] md:overflow-y-auto md:border md:border-black/5 dark:md:border-white/5">
        <SiteHeader user={session.user} />
        {showBanner && <BillingBanner notice={notice} dismissKey={dismissKey} />}
        <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
        <SiteFooter />
        {/* useSearchParams (replay link): client-only. */}
        <Suspense fallback={null}>
          <ProductTour autoStart={!session.onboarding.tourCompleted} firstName={session.user.name} />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
