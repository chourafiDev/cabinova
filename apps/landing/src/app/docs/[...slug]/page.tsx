import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { DocsToc } from "@/components/docs/docs-toc";
import { IconArrowLeft, IconArrowRight, IconChevronRight } from "@/components/icons";
import { headingsOf, readDoc } from "@/lib/docs";
import { ALL_DOCS } from "@/lib/docs-nav";

export const dynamicParams = false;

export const generateStaticParams = () => ALL_DOCS.map(({ slug }) => ({ slug: slug.split("/") }));

const pageOf = (slug: string[]) => ALL_DOCS.find((page) => page.slug === slug.join("/"));

export async function generateMetadata({ params }: PageProps<"/docs/[...slug]">): Promise<Metadata> {
	const page = pageOf((await params).slug);
	return page ? { title: page.title, description: page.description } : {};
}

export default async function DocPage({ params }: PageProps<"/docs/[...slug]">) {
	const page = pageOf((await params).slug);
	if (!page) notFound();
	const markdown = await readDoc(page.slug);
	const headings = headingsOf(markdown);
	const index = ALL_DOCS.indexOf(page);
	const previous = ALL_DOCS[index - 1];
	const next = ALL_DOCS[index + 1];

	return (
		<div className="flex">
			<main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">
				<article className="mx-auto max-w-3xl">
					<nav aria-label="Fil d’Ariane" className="text-muted-foreground flex items-center gap-1 text-sm">
						<Link href="/docs" className="hover:text-foreground">
							Documentation
						</Link>
						<IconChevronRight className="size-3.5" />
						<span>{page.section}</span>
					</nav>
					<h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">{page.title}</h1>
					<p className="text-muted-foreground mt-2 text-lg text-pretty">{page.description}</p>
					<DocsToc headings={headings} variant="inline" />
					<div className="mt-8">
						<DocsMarkdown>{markdown}</DocsMarkdown>
					</div>
					<nav aria-label="Pages voisines" className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
						{previous && (
							<Link href={`/docs/${previous.slug}`} className="hover:border-primary/50 rounded-xl border p-4 transition-colors">
								<span className="text-muted-foreground flex items-center gap-1 text-xs">
									<IconArrowLeft className="size-3.5" /> Précédent
								</span>
								<span className="mt-1 block font-medium">{previous.title}</span>
							</Link>
						)}
						{next && (
							<Link href={`/docs/${next.slug}`} className="hover:border-primary/50 rounded-xl border p-4 text-end transition-colors sm:col-start-2">
								<span className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
									Suivant <IconArrowRight className="size-3.5" />
								</span>
								<span className="mt-1 block font-medium">{next.title}</span>
							</Link>
						)}
					</nav>
				</article>
			</main>
			<aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto py-10 pe-6 xl:block">
				<DocsToc headings={headings} variant="side" />
			</aside>
		</div>
	);
}
