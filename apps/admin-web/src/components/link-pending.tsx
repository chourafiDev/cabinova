"use client";

import { useLinkStatus } from "next/link";
import { LuLoaderCircle } from "react-icons/lu";

/**
 * A small spinner inside a <Link> while its page is still on the way (slow
 * network, or not prefetched yet), so the click is confirmed at once. Always
 * rendered at the same size, so showing it never shifts the menu.
 */
export function LinkPending() {
	const { pending } = useLinkStatus();
	return (
		<span
			aria-hidden
			className="ms-auto flex size-4 shrink-0 items-center justify-center transition-opacity group-data-[collapsible=icon]:hidden"
			style={{ opacity: pending ? 1 : 0 }}
		>
			<LuLoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
		</span>
	);
}
