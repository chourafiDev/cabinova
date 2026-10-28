"use client";

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
	{ value: "light", label: "Clair", icon: LuSun },
	{ value: "dark", label: "Sombre", icon: LuMoon },
	{ value: "system", label: "Système", icon: LuMonitor },
] as const;

/** Header button: light, dark or follow the system. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" aria-label="Thème de l’interface">
					{/* Both icons rendered, CSS picks one: no flash before the theme is known. */}
					<LuSun className="dark:hidden" />
					<LuMoon className="hidden dark:block" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Thème</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
					{THEMES.map(({ value, label, icon: Icon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<Icon />
							{label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
