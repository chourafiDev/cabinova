"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Open state of a "create" dialog that also opens from a link: `?nouveau=1`
 * (command palette actions). The parameter is then removed, so a refresh
 * or the back button doesn't reopen it.
 */
export function useOpenFromUrl(param = "nouveau") {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const fromUrl = searchParams.get(param) === "1";
	const [open, setOpen] = useState(fromUrl);

	useEffect(() => {
		if (!fromUrl) return;
		// Already on the page when the link was followed: no remount.
		// eslint-disable-next-line react-hooks/set-state-in-effect -- driven by the URL
		setOpen(true);
		const rest = new URLSearchParams(searchParams);
		rest.delete(param);
		router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
	}, [fromUrl, param, pathname, router, searchParams]);

	return [open, setOpen] as const;
}
