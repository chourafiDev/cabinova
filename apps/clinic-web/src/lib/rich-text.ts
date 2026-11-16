/** Plain text as editor HTML: escaped, one paragraph per line. */
export function textToHtml(text: string) {
	const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return escaped
		.split("\n")
		.map((line) => `<p>${line}</p>`)
		.join("");
}

/** Whether editor HTML holds any text ("<p></p>" doesn't). */
export const hasText = (html: string | null | undefined) =>
	!!html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() !== "";

/** How saved rich text reads outside the editor (history): paragraphs, lists, alignment kept. */
export const RICH_TEXT = "[&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ps-5";

/** Editor HTML as plain text, one line per paragraph or list item (saved phrases). */
export function htmlToText(html: string) {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|li)>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
