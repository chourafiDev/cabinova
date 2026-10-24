// Dashboard series colours. Each pair was run through the dataviz palette
// validator (lightness band, chroma, colour-blind ΔE, contrast) on the light
// and dark surfaces. Brand purple + ink fails the chroma floor, so charts use
// these instead. Light-mode contrast WARNs (pink, aqua, yellow) are covered by
// visible legends with values and the table view.

export type ThemedColor = { light: string; dark: string };

/** Monthly chart: new subscriptions vs cancellations. */
export const SUBSCRIPTION_COLORS = {
	newSubscriptions: { light: "#613F75", dark: "#613F75" },
	cancellations: { light: "#e87ba4", dark: "#d55181" },
} satisfies Record<string, ThemedColor>;

/** Plans, in catalog order (fixed: a filter never repaints a plan). */
export const PLAN_COLORS: ThemedColor[] = [
	{ light: "#613F75", dark: "#724e91" }, // violet
	{ light: "#00a896", dark: "#00a896" }, // aqua
	{ light: "#eda100", dark: "#c98500" }, // yellow
	{ light: "#2a78d6", dark: "#3987e5" }, // blue — never next to violet (fails ΔE)
];

/** "Sans offre": not a category of its own, so neutral grey. */
export const NEUTRAL: ThemedColor = { light: "#c3c2b7", dark: "#5f5e58" };

/** Single-series magnitude bars (cities, specialties). */
export const MAGNITUDE: ThemedColor = { light: "#724e91", dark: "#724e91" };
