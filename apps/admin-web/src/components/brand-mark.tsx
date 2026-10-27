import type { Branding } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** The platform's logo, or its initial on the brand colour. */
export function BrandMark({ branding, className }: { branding: Branding; className?: string }) {
	return branding.logoUrl ? (
		// Tiny logo served by the API; next/image would add nothing here.
		// eslint-disable-next-line @next/next/no-img-element
		<img src={`/api${branding.logoUrl}`} alt="" className={cn("size-8 shrink-0 rounded-lg object-contain", className)} />
	) : (
		<span
			className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold text-white", className)}
			style={{ backgroundColor: branding.primaryColor }}
		>
			{branding.platformName.charAt(0).toUpperCase()}
		</span>
	);
}
