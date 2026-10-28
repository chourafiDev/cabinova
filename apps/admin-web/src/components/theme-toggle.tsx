"use client";

import { Monitor, Moon, Sun } from "lucide-react";
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
	{ value: "light", label: "Clair", icon: Sun },
	{ value: "dark", label: "Sombre", icon: Moon },
	{ value: "system", label: "Système", icon: Monitor },
] as const;

/** Header button: light, dark or follow the system. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Thème de l’interface">
					{/* Both icons rendered, CSS picks one: no flash before the theme is known. */}
					<Sun className="dark:hidden" />
					<Moon className="hidden dark:block" />
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
