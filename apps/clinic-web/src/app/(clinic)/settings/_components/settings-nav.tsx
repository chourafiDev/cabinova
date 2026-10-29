"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SettingsSection } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
	const pathname = usePathname();
	return (
		<nav
			aria-label="Sections des paramètres"
			className="-mx-1 flex gap-1 overflow-x-auto px-1 md:sticky md:top-20 md:mx-0 md:grid md:overflow-visible md:px-0"
		>
			{sections.map((s) => {
				const active = pathname === s.href;
				return (
					<Link
						key={s.href}
						href={s.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"grid shrink-0 rounded-lg px-3 py-2 leading-tight transition-colors",
							active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
						)}
					>
						<span className="text-sm font-medium">{s.label}</span>
						<span className="text-muted-foreground hidden text-xs md:block">{s.hint}</span>
					</Link>
				);
			})}
		</nav>
	);
}
