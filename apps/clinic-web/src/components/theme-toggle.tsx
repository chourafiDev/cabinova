"use client";

import { useTranslations } from "next-intl";
import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
	{ value: "light", icon: LuSun },
	{ value: "dark", icon: LuMoon },
	{ value: "system", icon: LuMonitor },
] as const;

/** Header button: light, dark or follow the system. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const t = useTranslations("common.theme");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className="!shadow-none" aria-label={t("label")}>
					{/* Both icons rendered, CSS picks one: no flash before the theme is known. */}
					<LuSun className="dark:hidden" />
					<LuMoon className="hidden dark:block" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("title")}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
					{THEMES.map(({ value, icon: Icon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<Icon />
							{t(value)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
