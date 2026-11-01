import Link from "next/link";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { LuCircleAlert, LuInfo, LuLightbulb } from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

const CALLOUTS = {
	NOTE: { label: "À savoir", icon: LuInfo, tone: "border-primary/30 bg-accent", iconTone: "text-primary" },
	TIP: { label: "Conseil", icon: LuLightbulb, tone: "border-emerald-500/30 bg-emerald-500/8", iconTone: "text-emerald-600 dark:text-emerald-400" },
	WARNING: { label: "Attention", icon: LuCircleAlert, tone: "border-amber-500/40 bg-amber-500/10", iconTone: "text-amber-600 dark:text-amber-400" },
} as const;
const MARK = /^\[!(NOTE|TIP|WARNING)\]\s*/;

const textOf = (node: ReactNode): string =>
	Children.toArray(node)
		.map((child) => (typeof child === "string" ? child : isValidElement(child) ? textOf((child as ReactElement<{ children?: ReactNode }>).props.children) : ""))
		.join("");

/** "> [!NOTE] Text": the mark becomes a titled box. */
function Quote({ children }: { children?: ReactNode }) {
	const paragraph = Children.toArray(children).find(isValidElement) as ReactElement<{ children?: ReactNode }> | undefined;
	const [first, ...rest] = Children.toArray(paragraph?.props.children);
	const mark = typeof first === "string" ? MARK.exec(first) : null;
	if (!mark) return <blockquote className="text-muted-foreground my-5 border-s-2 ps-4">{children}</blockquote>;
	const { label, icon: Icon, tone, iconTone } = CALLOUTS[mark[1] as keyof typeof CALLOUTS];
	return (
		<aside className={cn("my-5 flex gap-3 rounded-xl border p-4 text-[0.9375rem] leading-relaxed", tone)}>
			<Icon className={cn("mt-1 size-4 shrink-0", iconTone)} />
			<div className="min-w-0">
				<strong className="font-semibold">{label}</strong>
				<p className="mt-0.5">
					{(first as string).replace(MARK, "")}
					{rest}
				</p>
			</div>
		</aside>
	);
}

const heading = (Tag: "h2" | "h3", className: string) =>
	function Heading({ children }: { children?: ReactNode }) {
		const id = slugify(textOf(children));
		return (
			<Tag id={id} className={cn("group scroll-mt-20 font-semibold tracking-tight", className)}>
				{children}
				<a href={`#${id}`} aria-label="Lien vers cette section" className="text-muted-foreground ms-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
					#
				</a>
			</Tag>
		);
	};

/** A page's Markdown, in the documentation's typography. */
export function DocsMarkdown({ children }: { children: string }) {
	return (
		<div className="text-[1.0625rem] leading-relaxed">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					h2: heading("h2", "mt-10 mb-3 border-b pb-2 text-2xl first:mt-0"),
					h3: heading("h3", "mt-7 mb-2 text-lg"),
					p: ({ children }) => <p className="my-4">{children}</p>,
					ul: ({ children }) => <ul className="my-4 list-disc space-y-1.5 ps-6 marker:text-muted-foreground">{children}</ul>,
					ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 ps-6 marker:font-medium marker:text-primary">{children}</ol>,
					strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
					a: ({ href = "", children }) =>
						href.startsWith("/") ? (
							<Link href={href} className="text-primary font-medium underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
								{children}
							</Link>
						) : (
							<a href={href} className="text-primary font-medium underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
								{children}
							</a>
						),
					code: ({ children }) => <code className="bg-muted rounded-md border px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>,
					blockquote: Quote,
					table: ({ children }) => (
						<div className="my-5 overflow-x-auto rounded-xl border">
							<table className="w-full text-start text-[0.9375rem]">{children}</table>
						</div>
					),
					thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
					th: ({ children }) => <th className="border-b px-4 py-2.5 text-start font-semibold whitespace-nowrap">{children}</th>,
					td: ({ children }) => <td className="border-b px-4 py-2.5 align-top [tr:last-child_&]:border-b-0">{children}</td>,
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}
