"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LuArrowLeft, LuMenu, LuX } from "react-icons/lu";
import { Logo } from "@/components/landing/logo";
import { DocsNav } from "./docs-nav";
import { DocsSearchButton } from "./docs-search";

export function DocsHeader() {
	const [menu, setMenu] = useState(false);
	const pathname = usePathname();

	useEffect(() => {
		document.body.style.overflow = menu ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [menu]);

	return (
		<>
			<header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
				<div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
					<button
						type="button"
						onClick={() => setMenu((open) => !open)}
						aria-expanded={menu}
						aria-label={menu ? "Fermer le plan" : "Ouvrir le plan"}
						className="hover:bg-muted -ms-1.5 flex size-9 items-center justify-center rounded-lg lg:hidden"
					>
						{menu ? <LuX className="size-5" /> : <LuMenu className="size-5" />}
					</button>
					<Link href="/docs" aria-label="Accueil de la documentation" className="flex items-center gap-2.5">
						<Logo />
						<span className="text-muted-foreground hidden border-s ps-2.5 text-sm font-medium sm:inline">Documentation</span>
					</Link>
					<div className="ms-auto w-10 sm:w-64">
						<DocsSearchButton />
					</div>
					<Link href="/" className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-sm md:flex">
						<LuArrowLeft className="size-4" /> Retour au site
					</Link>
				</div>
			</header>
			{menu && (
				<div key={pathname} className="bg-background fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto px-4 py-6 lg:hidden">
					<DocsNav onNavigate={() => setMenu(false)} />
					<Link href="/" className="text-muted-foreground mt-6 flex items-center gap-1.5 border-t px-3 pt-4 text-sm">
						<LuArrowLeft className="size-4" /> Retour au site
					</Link>
				</div>
			)}
		</>
	);
}
