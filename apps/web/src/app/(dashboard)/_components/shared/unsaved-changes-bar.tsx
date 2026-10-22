"use client";

import { Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shopify-style unsaved-changes popup: slides down from the top. Place it
 * inside the <form>, or pass `formId` to submit a form elsewhere on the page.
 */
export function UnsavedChangesBar({
	visible,
	label,
	isSubmitting,
	onDiscard,
	formId,
}: {
	visible: boolean;
	label: string;
	isSubmitting: boolean;
	onDiscard: () => void;
	formId?: string;
}) {
	return (
		<div
			role="status"
			aria-live="polite"
			inert={!visible}
			className={cn(
				"bg-test fixed top-3 text-white/90 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-4 rounded-xl py-2 ps-4 pe-2 shadow-lg ring-1 ring-white/10",
				"transition-[translate,opacity] duration-300 ease-out",
				visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0",
			)}
		>
			<p className="text-sm font-medium">{label}</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="border-white/20 bg-transparent text-white/90 hover:bg-white/10 hover:text-white"
					onClick={onDiscard}
				>
					Ignorer
				</Button>
				<Button type="submit" form={formId} size="sm" disabled={isSubmitting}>
					{isSubmitting && <Loader className="size-4 animate-spin" />}
					Enregistrer
				</Button>
			</div>
		</div>
	);
}
