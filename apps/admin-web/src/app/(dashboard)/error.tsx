"use client"; // Error boundaries must be Client Components

import { LuRotateCcw, LuTriangleAlert } from "react-icons/lu";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Dashboard page error (inside the sidebar layout): retry or back to the dashboard. */
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
			<div className="bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center rounded-full">
				<LuTriangleAlert className="size-5" />
			</div>
			<h1 className="text-lg font-semibold">Une erreur est survenue</h1>
			<p className="text-muted-foreground mt-1 max-w-md text-sm">
				Cette page n&apos;a pas pu se charger. Réessayez ; si le problème persiste, notez le code ci-dessous.
			</p>
			{error.digest && <p className="text-muted-foreground mt-2 font-mono text-xs">Code : {error.digest}</p>}
			<div className="mt-6 flex gap-2">
				<Button onClick={() => retry()}>
					<LuRotateCcw className="size-4" />
					Réessayer
				</Button>
				<Button asChild variant="outline">
					<Link href="/">Tableau de bord</Link>
				</Button>
			</div>
		</div>
	);
}
