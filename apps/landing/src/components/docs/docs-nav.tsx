"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

/** The plan of the documentation: in the sidebar, and in the phone menu. */
export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
	const pathname = usePathname();
	return (
		<nav aria-label="Plan de la documentation" className="grid gap-6 text-sm">
			{DOCS.map((section) => (
				<div key={section.title}>
					<p className="px-3 pb-1.5 font-semibold">{section.title}</p>
					<ul className="grid gap-0.5">
						{section.pages.map((page) => {
							const href = `/docs/${page.slug}`;
							const active = pathname === href;
							return (
								<li key={page.slug}>
									<Link
										href={href}
										onClick={onNavigate}
										aria-current={active ? "page" : undefined}
										className={cn(
											"block rounded-lg px-3 py-1.5 transition-colors",
											active ? "bg-accent text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
									>
										{page.title}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}
