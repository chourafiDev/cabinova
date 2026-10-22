"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/lib/focus-ring";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="relative">
			<Input type={visible ? "text" : "password"} className={cn("pe-11", className)} {...props} />
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
				className={cn(
					focusRing,
					"text-muted-foreground hover:text-foreground absolute inset-y-1 end-1 flex w-9 items-center justify-center rounded-md",
				)}
			>
				{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
			</button>
		</div>
	);
}
