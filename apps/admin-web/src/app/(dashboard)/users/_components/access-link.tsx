"use client";

import { LuCheck, LuCopy } from "react-icons/lu";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The one-time link, shown once to the admin who generated it (it is also
 * e-mailed). Useful while e-mail sending isn't configured.
 */
export function AccessLink({ url, isReset }: { url: string; isReset: boolean }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="grid gap-2 rounded-lg border p-3 text-sm text-sky-950">
			<p>
				{isReset ? "Lien de nouveau mot de passe" : "Lien d’invitation"} envoyé par e-mail, valable 7 jours et à usage
				unique. Vous pouvez aussi le transmettre vous-même :
			</p>
			<div className="flex gap-2">
				<Input readOnly value={url} className="bg-background font-mono text-xs" onFocus={(e) => e.target.select()} />
				<Button
					type="button"
					variant="outline"
					onClick={async () => {
						await navigator.clipboard.writeText(url);
						setCopied(true);
					}}
				>
					{copied ? <LuCheck /> : <LuCopy />} {copied ? "Copié" : "Copier"}
				</Button>
			</div>
		</div>
	);
}
