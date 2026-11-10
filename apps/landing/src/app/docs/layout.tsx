import type { Metadata } from 'next';
import { DocsHeader } from '@/components/docs/docs-header';
import { DocsNav } from '@/components/docs/docs-nav';
import { DocsSearchProvider } from '@/components/docs/docs-search';

export const metadata: Metadata = {
  title: {
    default: 'Documentation — Cabinova',
    template: '%s — Documentation Cabinova',
  },
  description:
    'Le guide complet de Cabinova : agenda, patients, encaissements, équipe, sécurité et abonnement.',
};

/** Header on top, the plan on the left; each page brings its own "on this page". */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DocsSearchProvider>
      <div className="min-h-svh">
        <DocsHeader />
        <div className="mx-auto flex max-w-[90rem]">
          <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-72 shrink-0 overflow-y-auto border-e px-4 py-6 lg:block">
            <DocsNav />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </DocsSearchProvider>
  );
}
