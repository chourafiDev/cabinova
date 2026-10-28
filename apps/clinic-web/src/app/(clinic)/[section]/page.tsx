import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LuConstruction } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { allNavItems } from "../_components/nav";

const sectionOf = (section: string) => allNavItems.find((i) => i.soon && i.href === `/${section}`);

export function generateStaticParams() {
  return allNavItems.filter((i) => i.soon).map((i) => ({ section: i.href.slice(1) }));
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  return { title: sectionOf((await params).section)?.title };
}

/** Placeholder for the sections of the sidebar that aren't built yet. */
export default async function SoonPage({ params }: PageProps<"/[section]">) {
  const item = sectionOf((await params).section);
  if (!item) notFound();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <item.icon className="size-5 text-muted-foreground" />
      </span>
      <h1 className="text-lg font-semibold">{item.title}</h1>
      <p className="flex max-w-sm items-center gap-1.5 text-sm text-muted-foreground">
        <LuConstruction className="size-4 shrink-0" />
        Cette section arrive bientôt.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
