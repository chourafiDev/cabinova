"use client";

import { createContext, type TransitionStartFunction, use, useTransition } from "react";

// Shares a list page's loading state (filters/sort/page change → server
// re-renders) between its parts, e.g. the header spinner and the table.
const ListTransitionContext = createContext<{
	isPending: boolean;
	startTransition: TransitionStartFunction;
} | null>(null);

export function ListTransitionProvider({ children }: { children: React.ReactNode }) {
	const [isPending, startTransition] = useTransition();
	return (
		<ListTransitionContext value={{ isPending, startTransition }}>
			{children}
		</ListTransitionContext>
	);
}

export function useListTransition() {
	const context = use(ListTransitionContext);
	if (!context) {
		throw new Error("useListTransition must be used inside ListTransitionProvider");
	}
	return context;
}
