import type { CSSProperties } from "react";
import type { TEventColor } from "@/calendar/types";

/** An act's custom colour ("#14b8a6"), beside the palette's names. */
export type TCustomColor = `#${string}`;
export type TAnyColor = TEventColor | TCustomColor;

export const isCustomColor = (color: string): color is TCustomColor => color.startsWith("#");

/**
 * A custom colour reaches the classes below through `--ev`: a light tint,
 * a border and a readable text are mixed from it, in light and dark mode.
 */
export const customColorStyle = (color: TAnyColor): CSSProperties | undefined =>
	isCustomColor(color) ? ({ "--ev": color } as CSSProperties) : undefined;

/** An event card in a custom colour (as the palette's "colored" variants). */
export const CUSTOM_TINT =
	"border-[color-mix(in_oklab,var(--ev)_35%,transparent)] bg-[color-mix(in_oklab,var(--ev)_12%,white)] text-[color-mix(in_oklab,var(--ev)_65%,black)] dark:border-[color-mix(in_oklab,var(--ev)_45%,transparent)] dark:bg-[color-mix(in_oklab,var(--ev)_22%,black)] dark:text-[color-mix(in_oklab,var(--ev)_55%,white)] [&_.event-dot]:fill-(--ev)";

/** An event card in a custom colour, "dot" style (neutral card, coloured dot). */
export const CUSTOM_DOT = "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-(--ev)";

/** A solid dot or bullet in a custom colour. */
export const CUSTOM_SOLID = "bg-(--ev)";

/** The variant key of a colour for the calendar's cva variants. */
export const colorVariant = (color: TAnyColor, dot: boolean) =>
	isCustomColor(color) ? (dot ? "custom-dot" : "custom") : dot ? (`${color}-dot` as const) : color;
