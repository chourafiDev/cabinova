"use client";

import { useEffect, useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils";

type Heading = { level: number; text: string; id: string };

function Links({ headings, active }: { headings: Heading[]; active?: string }) {
	return (
		<ul className="grid gap-1.5 text-sm">
			{headings.map((heading) => (
				<li key={heading.id} className={cn(heading.level === 3 && "ps-3")}>
					<a
						href={`#${heading.id}`}
						aria-current={active === heading.id ? "location" : undefined}
						className={cn("block leading-snug transition-colors", active === heading.id ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
					>
						{heading.text}
					</a>
				</li>
			))}
		</ul>
	);
}

/** "Sur cette page": beside the text on wide screens, folded above it otherwise. */
export function DocsToc({ headings, variant }: { headings: Heading[]; variant: "side" | "inline" }) {
	const [active, setActive] = useState<string | undefined>(headings[0]?.id);

	useEffect(() => {
		if (variant !== "side") return;
		const elements = headings.flatMap((h) => document.getElementById(h.id) ?? []);
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (visible) setActive(visible.target.id);
			},
			{ rootMargin: "-80px 0px -70% 0px" },
		);
		elements.forEach((element) => observer.observe(element));
		return () => observer.disconnect();
	}, [headings, variant]);

	if (headings.length === 0) return null;
	if (variant === "side") {
		return (
			<nav aria-label="Sur cette page">
				<p className="mb-3 text-sm font-semibold">Sur cette page</p>
				<Links headings={headings} active={active} />
			</nav>
		);
	}
	return (
		<details className="group bg-muted/50 mt-6 rounded-xl border px-4 py-3 xl:hidden">
			<summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
				Sur cette page
				<LuChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
			</summary>
			<div className="mt-3">
				<Links headings={headings} />
			</div>
		</details>
	);
}
