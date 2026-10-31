"use client";

import { useTranslations } from "next-intl";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/lib/focus-ring";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
	const [visible, setVisible] = useState(false);
	const t = useTranslations("auth");
	return (
		<div className="relative">
			<Input type={visible ? "text" : "password"} className={cn("pe-11", className)} {...props} />
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? t("hidePassword") : t("showPassword")}
				className={cn(
					focusRing,
					"text-muted-foreground hover:text-foreground absolute inset-y-1 end-1 flex w-9 items-center justify-center rounded-md",
				)}
			>
				{visible ? <LuEyeOff className="size-4" /> : <LuEye className="size-4" />}
			</button>
		</div>
	);
}
