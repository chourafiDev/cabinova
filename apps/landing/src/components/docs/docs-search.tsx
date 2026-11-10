"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconDocument, IconEnter, IconHash, IconSearch, IconSpinner } from "@/components/icons";
import type { SearchEntry } from "@/lib/docs";
import { cn } from "@/lib/utils";

/** Accents and case don't matter: "reçu" and "recu" find the same page. */
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();

type Result = { key: string; href: string; title: string; context: string; snippet: string; heading: boolean };

function search(index: SearchEntry[], query: string): Result[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const has = (text: string) => words.every((word) => fold(text).includes(word));
	const scored = index.flatMap((page) => {
		const heading = page.headings.find((h) => has(h.text));
		const inTitle = has(page.title);
		const inDescription = has(page.description);
		const inText = has(`${page.title} ${page.text}`);
		if (!inTitle && !heading && !inDescription && !inText) return [];
		const folded = fold(page.text);
		const at = folded.indexOf(words[0]);
		const snippet = at < 0 || inDescription ? page.description : `…${page.text.slice(Math.max(0, at - 50), at + 110)}…`;
		return [
			{
				score: inTitle ? 3 : heading ? 2 : inDescription ? 1 : 0,
				key: page.slug,
				href: `/docs/${page.slug}${!inTitle && heading ? `#${heading.id}` : ""}`,
				title: !inTitle && heading ? heading.text : page.title,
				context: !inTitle && heading ? `${page.section} › ${page.title}` : page.section,
				snippet,
				heading: !inTitle && !!heading,
			},
		];
	});
	return scored.sort((a, b) => b.score - a.score).slice(0, 8);
}

const SearchContext = createContext<() => void>(() => {});

/** The search box itself, opened from anywhere with ⌘K, Ctrl+K or "/". */
function SearchDialog({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const [index, setIndex] = useState<SearchEntry[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const list = useRef<HTMLUListElement>(null);

	useEffect(() => {
		fetch("/docs/search.json")
			.then((res) => res.json())
			.then(setIndex)
			.catch(() => setFailed(true));
	}, []);
	useEffect(() => {
		list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
	}, [selected]);

	const results = useMemo(() => (index ? search(index, query) : []), [index, query]);
	const go = (result: Result) => {
		onClose();
		router.push(result.href);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div role="dialog" aria-modal="true" aria-label="Rechercher dans la documentation" className="bg-card w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl">
				<div className="flex items-center gap-3 border-b px-4">
					<IconSearch className="text-muted-foreground size-5 shrink-0" />
					<input
						autoFocus
						type="search"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelected(0);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") onClose();
							else if (e.key === "ArrowDown") {
								e.preventDefault();
								setSelected((i) => Math.min(i + 1, results.length - 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setSelected((i) => Math.max(i - 1, 0));
							} else if (e.key === "Enter" && results[selected]) go(results[selected]);
						}}
						placeholder="Rechercher un guide…"
						aria-label="Rechercher"
						className="h-14 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
					/>
					{!index && !failed && <IconSpinner className="text-muted-foreground size-4 animate-spin" />}
					<kbd className="text-muted-foreground bg-muted hidden rounded border px-1.5 py-0.5 text-xs sm:block">Échap</kbd>
				</div>
				{failed ? (
					<p className="text-muted-foreground p-8 text-center text-sm">La recherche est indisponible pour le moment.</p>
				) : query.trim() === "" ? (
					<p className="text-muted-foreground p-8 text-center text-sm">Essayez « reçu », « secrétaire » ou « clôture ».</p>
				) : index && results.length === 0 ? (
					<p className="text-muted-foreground p-8 text-center text-sm">Aucun résultat pour « {query} ».</p>
				) : (
					<ul ref={list} role="listbox" aria-label="Résultats" className="max-h-[50vh] overflow-y-auto p-2">
						{results.map((result, i) => {
							const Icon = result.heading ? IconHash : IconDocument;
							return (
								<li key={result.key} role="option" aria-selected={i === selected}>
									<button
										type="button"
										onMouseEnter={() => setSelected(i)}
										onClick={() => go(result)}
										className={cn("flex w-full items-start gap-3 rounded-xl p-3 text-start", i === selected && "bg-accent")}
									>
										<Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
										<span className="min-w-0 flex-1">
											<span className="text-muted-foreground block text-xs">{result.context}</span>
											<span className="block font-medium">{result.title}</span>
											<span className="text-muted-foreground mt-0.5 line-clamp-2 block text-sm">{result.snippet}</span>
										</span>
										{i === selected && <IconEnter className="text-muted-foreground mt-1 hidden size-4 shrink-0 sm:block" />}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

/** Holds the dialog for every button of the documentation. */
export function DocsSearchProvider({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const show = useCallback(() => setOpen(true), []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea");
			if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
				e.preventDefault();
				setOpen(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<SearchContext value={show}>
			{children}
			{open && createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body)}
		</SearchContext>
	);
}

export function DocsSearchButton({ large }: { large?: boolean }) {
	const open = useContext(SearchContext);
	return (
		<button
			type="button"
			onClick={open}
			aria-label="Rechercher dans la documentation"
			className={cn(
				"bg-muted/60 hover:bg-muted text-muted-foreground flex w-full items-center gap-2 rounded-lg border text-sm transition-colors",
				large ? "h-12 px-4 text-base" : "h-9 justify-center px-2.5 sm:justify-start",
			)}
		>
			<IconSearch className="size-4 shrink-0" />
			<span className={cn(!large && "hidden sm:inline")}>Rechercher…</span>
			<kbd className={cn("bg-background ms-auto rounded border px-1.5 py-0.5 text-[0.6875rem]", !large && "hidden sm:block")}>⌘K</kbd>
		</button>
	);
}
