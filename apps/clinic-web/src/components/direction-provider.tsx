"use client";

import { Direction } from "radix-ui";

/** Menus, tabs and sliders read the direction from here, not from the page. */
export function DirectionProvider({ dir, children }: { dir: "ltr" | "rtl"; children: React.ReactNode }) {
	return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
