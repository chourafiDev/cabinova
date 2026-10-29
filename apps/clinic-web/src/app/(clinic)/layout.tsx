import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CabinetUnavailable } from '@/components/cabinet-unavailable';
import { CurrentUserProvider } from '@/components/current-user';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { billingNotice } from '@/lib/billing-notice';
import { getClinicState } from '@/lib/session';
import { Suspense } from 'react';
import { BillingBanner } from './_components/billing/billing-banner';
import { allNavItems } from './_components/nav';
import { ProductTour } from './_components/tour/product-tour';
import { AppSidebar } from './_components/app-sidebar';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

/** The cabinet comes from the subdomain (clinic-api); every page needs a session. */
export default async function ClinicLayout({ children }: LayoutProps<'/'>) {
  const state = await getClinicState();
  if (state.status === 'unavailable')
    return <CabinetUnavailable reason={state.reason} />;
  if (state.status === 'signed-out') redirect('/login');
  const { session } = state;
  const cookieStore = await cookies();
  // Remember whether the sidebar was collapsed (cookie set by the sidebar).
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  // Stays up for the whole trial (and while an invoice is unpaid): no close button.
  const notice = billingNotice(session, new Date());

  return (
    <CurrentUserProvider
      user={{
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      }}
    >
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar
          cabinet={session.cabinet}
          spaces={session.spaces}
          role={session.user.role}
        />
        {/* Inset panel: fixed frame on desktop, the page scrolls inside it. */}
        <SidebarInset className="min-w-0 md:h-[calc(100svh-1rem)] md:overflow-y-auto md:border md:border-black/5 dark:md:border-white/5">
          <SiteHeader user={session.user} spaces={session.spaces} />
          {notice && <BillingBanner notice={notice} />}
          <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
          <SiteFooter />
          <KeyboardShortcuts
            navigation={allNavItems
              .filter((i) => i.shortcut)
              .map((i) => ({ key: i.shortcut!, label: i.title, href: i.href }))}
          />
          {/* useSearchParams (replay link): client-only. */}
          <Suspense fallback={null}>
            <ProductTour
              autoStart={!session.onboarding.tourCompleted}
              firstName={session.user.name}
            />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </CurrentUserProvider>
  );
}
