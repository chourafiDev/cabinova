"use client";

import { useEffect, useRef, useState } from "react";
import { LuArrowRight, LuLogIn, LuMenu, LuX } from "react-icons/lu";
import { clinicUrl, demoHref, NAV, TENANT_BASE_DOMAIN } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** Sticky top bar: sections, sign-in to one's cabinet, the demo request. */
export function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [menu, setMenu] = useState(false);
	const [login, setLogin] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-50 transition-colors duration-300",
				scrolled || menu ? "bg-background/80 border-b backdrop-blur-xl" : "border-b border-transparent",
			)}
		>
			<nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Navigation principale">
				<a href="#" aria-label="Cabinova, retour en haut" className="shrink-0">
					<Logo />
				</a>
				<ul className="text-muted-foreground hidden flex-1 items-center justify-center gap-1 text-sm lg:flex">
					{NAV.map((item) => (
						<li key={item.href}>
							<a href={item.href} className="hover:bg-muted hover:text-foreground rounded-full px-3 py-1.5 transition-colors">
								{item.label}
							</a>
						</li>
					))}
				</ul>
				<div className="ms-auto flex items-center gap-2 lg:ms-0">
					<button
						type="button"
						onClick={() => setLogin(true)}
						className="hover:bg-muted hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors sm:flex"
					>
						<LuLogIn className="size-4" /> Se connecter
					</button>
					<a
						href={demoHref}
						className="bg-primary text-primary-foreground hidden h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm transition hover:opacity-90 sm:flex"
					>
						Demander une démo <LuArrowRight className="size-4" />
					</a>
					<button
						type="button"
						className="hover:bg-muted flex size-9 items-center justify-center rounded-full lg:hidden"
						aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
						aria-expanded={menu}
						onClick={() => setMenu((m) => !m)}
					>
						{menu ? <LuX className="size-5" /> : <LuMenu className="size-5" />}
					</button>
				</div>
			</nav>
			{menu && (
				<div className="border-t px-4 pb-4 lg:hidden">
					<ul className="grid gap-1 py-3">
						{NAV.map((item) => (
							<li key={item.href}>
								<a href={item.href} onClick={() => setMenu(false)} className="hover:bg-muted block rounded-lg px-3 py-2 text-sm">
									{item.label}
								</a>
							</li>
						))}
					</ul>
					<div className="grid gap-2 sm:hidden">
						<button
							type="button"
							onClick={() => {
								setMenu(false);
								setLogin(true);
							}}
							className="flex h-10 items-center justify-center gap-1.5 rounded-full border text-sm font-medium"
						>
							<LuLogIn className="size-4" /> Se connecter
						</button>
						<a href={demoHref} className="bg-primary text-primary-foreground flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-medium">
							Demander une démo <LuArrowRight className="size-4" />
						</a>
					</div>
				</div>
			)}
			{login && <LoginDialog onClose={() => setLogin(false)} />}
		</header>
	);
}

/** Each cabinet has its own address: ask for it, then go there. */
function LoginDialog({ onClose }: { onClose: () => void }) {
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		input.current?.focus();
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const go = (e: React.FormEvent) => {
		e.preventDefault();
		const subdomain = value.trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0];
		if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
			return setError("Saisissez l’adresse de votre cabinet, par exemple « atlas ».");
		}
		// Another site (the cabinet's own address), not a page of this app.
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.href = `${clinicUrl(subdomain)}/login`;
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[18vh] backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="login-title"
				className="bg-card w-full max-w-md rounded-2xl border p-6 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="login-title" className="text-lg font-semibold">
							Accéder à mon cabinet
						</h2>
						<p className="text-muted-foreground mt-1 text-sm">Chaque cabinet a sa propre adresse Cabinova.</p>
					</div>
					<button type="button" onClick={onClose} className="hover:bg-muted rounded-full p-1.5" aria-label="Fermer">
						<LuX className="size-4" />
					</button>
				</div>
				<form onSubmit={go} className="grid gap-3">
					<label htmlFor="cabinet-address" className="text-sm font-medium">
						Adresse du cabinet
					</label>
					<div
						className={cn(
							"focus-within:ring-primary/30 flex items-center overflow-hidden rounded-xl border focus-within:ring-4",
							error && "border-red-500",
						)}
					>
						<input
							ref={input}
							id="cabinet-address"
							value={value}
							onChange={(e) => {
								setValue(e.target.value);
								setError(null);
							}}
							placeholder="atlas"
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none"
						/>
						<span className="text-muted-foreground bg-muted flex h-11 items-center border-s px-3 text-sm">.{TENANT_BASE_DOMAIN}</span>
					</div>
					{error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
					<button type="submit" className="bg-primary text-primary-foreground mt-1 flex h-11 items-center justify-center gap-1.5 rounded-xl font-medium">
						Continuer <LuArrowRight className="size-4" />
					</button>
				</form>
			</div>
		</div>
	);
}
