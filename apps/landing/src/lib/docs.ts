import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_DOCS, slugify } from "./docs-nav";

const ROOT = path.join(process.cwd(), "src/content/docs");

export const readDoc = (slug: string) => readFile(path.join(ROOT, `${slug}.md`), "utf8");

/** The ## and ### of a page, for "Sur cette page". */
export function headingsOf(markdown: string) {
	return [...markdown.matchAll(/^(#{2,3}) (.+)$/gm)].map(([, marks, text]) => ({
		level: marks.length,
		text: text.trim(),
		id: slugify(text),
	}));
}

/** What the search reads: plain text, without Markdown marks. */
const plain = (markdown: string) =>
	markdown
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^>\s*\[![A-Z]+\]\s*/gm, "")
		.replace(/[#>*`|]/g, " ")
		.replace(/-{3,}/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export async function searchIndex() {
	return Promise.all(
		ALL_DOCS.map(async ({ slug, title, description, section }) => {
			const markdown = await readDoc(slug);
			return { slug, title, description, section, headings: headingsOf(markdown), text: plain(markdown) };
		}),
	);
}

export type SearchEntry = Awaited<ReturnType<typeof searchIndex>>[number];
