"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { IconMonitor, IconMoon, IconSun } from "@/components/icons";
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
	{ value: "light", icon: IconSun },
	{ value: "dark", icon: IconMoon },
	{ value: "system", icon: IconMonitor },
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
					<IconSun className="dark:hidden" />
					<IconMoon className="hidden dark:block" />
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
