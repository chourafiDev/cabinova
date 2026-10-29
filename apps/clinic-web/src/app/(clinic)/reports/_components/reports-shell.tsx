"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition } from "react";
import { cn } from "@/lib/utils";

const NavigateContext = createContext<(href: string) => void>(() => {});

/** Changes the filters (URL); the figures below stay, dimmed, until the new ones arrive. */
export const useReportsNavigate = () => useContext(NavigateContext);

export function ReportsShell({ filters, children }: { filters: React.ReactNode; children: React.ReactNode }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));

	return (
		<NavigateContext value={navigate}>
			{filters}
			<div aria-busy={pending} className={cn("grid gap-4 transition-opacity", pending && "pointer-events-none opacity-60")}>
				{children}
			</div>
		</NavigateContext>
	);
}
