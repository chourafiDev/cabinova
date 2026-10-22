"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Read-only link + copy button (until invitations are sent by e-mail). */
export function AccessLink({ url }: { url: string }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Copie impossible : sélectionnez le lien manuellement.");
		}
	}

	return (
		<div className="flex gap-2">
			<Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
			<Button type="button" variant="outline" onClick={copy} className="shrink-0">
				{copied ? <Check className="size-4" /> : <Copy className="size-4" />}
				{copied ? "Copié" : "Copier"}
			</Button>
		</div>
	);
}
