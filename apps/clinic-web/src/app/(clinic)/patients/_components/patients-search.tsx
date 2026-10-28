"use client";

import { Loader, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

/** Search box of the list: updates ?search= as you type (page back to 1). */
export function PatientsSearch() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const current = params.get("search") ?? "";
	const [value, setValue] = useState(current);
	const [pending, startTransition] = useTransition();

	useEffect(() => {
		if (value.trim() === current) return;
		const timer = setTimeout(() => {
			const next = new URLSearchParams(params);
			if (value.trim()) next.set("search", value.trim());
			else next.delete("search");
			next.delete("page");
			startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
		}, 250);
		return () => clearTimeout(timer);
	}, [value, current, params, pathname, router]);

	return (
		<div className="relative w-full sm:w-80">
			<Search className="text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
			<Input
				type="search"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Nom, téléphone, CIN ou n° de dossier"
				aria-label="Rechercher un patient"
				className="ps-8"
			/>
			{pending && (
				<Loader className="text-muted-foreground absolute end-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin" />
			)}
		</div>
	);
}
