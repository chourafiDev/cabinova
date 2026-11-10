"use client";

import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, type Editor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
	type AppIcon,
	IconAlignCenter,
	IconAlignJustify,
	IconAlignLeft,
	IconAlignRight,
	IconBold,
	IconItalic,
	IconList,
	IconListOrdered,
	IconRedo,
	IconStrikethrough,
	IconUnderline,
	IconUndo,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Formatted text for printed documents (certificates): bold, italic,
 * underline, alignment and lists — what the API keeps when it cleans the
 * HTML, nothing more. `value` may change from outside (a model applied).
 */
export function RichTextEditor({
	value,
	onChange,
	id,
	className,
	minHeight = "min-h-56",
}: {
	value: string;
	onChange: (html: string) => void;
	id?: string;
	className?: string;
	minHeight?: string;
}) {
	// What the editor last reported: a different value comes from outside.
	const emitted = useRef(value);
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: false,
				code: false,
				codeBlock: false,
				blockquote: false,
				horizontalRule: false,
				link: false,
			}),
			TextAlign.configure({ types: ["paragraph"] }),
		],
		content: value,
		editorProps: {
			attributes: {
				...(id && { id }),
				class: cn(
					"px-4 py-3 text-sm leading-relaxed outline-none [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ps-6",
					minHeight,
				),
			},
		},
		onUpdate: ({ editor: e }) => {
			emitted.current = e.getHTML();
			onChange(emitted.current);
		},
	});

	useEffect(() => {
		if (!editor || value === emitted.current) return;
		emitted.current = value;
		editor.commands.setContent(value, { emitUpdate: false });
	}, [editor, value]);

	return (
		<div
			className={cn(
				"bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-lg border focus-within:ring-3",
				className,
			)}
		>
			{editor && <Toolbar editor={editor} />}
			<EditorContent editor={editor} />
		</div>
	);
}

function Toolbar({ editor }: { editor: Editor }) {
	const t = useTranslations("common.editor");
	const state = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			italic: e.isActive("italic"),
			underline: e.isActive("underline"),
			strike: e.isActive("strike"),
			bulletList: e.isActive("bulletList"),
			orderedList: e.isActive("orderedList"),
			left: e.isActive({ textAlign: "left" }),
			center: e.isActive({ textAlign: "center" }),
			right: e.isActive({ textAlign: "right" }),
			justify: e.isActive({ textAlign: "justify" }),
			undo: e.can().undo(),
			redo: e.can().redo(),
		}),
	});
	const chain = () => editor.chain().focus();
	const groups: { key: string; icon: AppIcon; active?: boolean; disabled?: boolean; run: () => void }[][] = [
		[
			{ key: "bold", icon: IconBold, active: state.bold, run: () => chain().toggleBold().run() },
			{ key: "italic", icon: IconItalic, active: state.italic, run: () => chain().toggleItalic().run() },
			{ key: "underline", icon: IconUnderline, active: state.underline, run: () => chain().toggleUnderline().run() },
			{ key: "strike", icon: IconStrikethrough, active: state.strike, run: () => chain().toggleStrike().run() },
		],
		[
			{ key: "left", icon: IconAlignLeft, active: state.left, run: () => chain().setTextAlign("left").run() },
			{ key: "center", icon: IconAlignCenter, active: state.center, run: () => chain().setTextAlign("center").run() },
			{ key: "right", icon: IconAlignRight, active: state.right, run: () => chain().setTextAlign("right").run() },
			{ key: "justify", icon: IconAlignJustify, active: state.justify, run: () => chain().setTextAlign("justify").run() },
		],
		[
			{ key: "bulletList", icon: IconList, active: state.bulletList, run: () => chain().toggleBulletList().run() },
			{ key: "orderedList", icon: IconListOrdered, active: state.orderedList, run: () => chain().toggleOrderedList().run() },
		],
		[
			{ key: "undo", icon: IconUndo, disabled: !state.undo, run: () => chain().undo().run() },
			{ key: "redo", icon: IconRedo, disabled: !state.redo, run: () => chain().redo().run() },
		],
	];

	return (
		<div className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1" role="toolbar" aria-label={t("toolbar")}>
			{groups.map((group, i) => (
				<div key={group[0].key} className={cn("flex gap-0.5", i > 0 && "border-s ps-1 ms-0.5")}>
					{group.map(({ key, icon: Icon, active, disabled, run }) => (
						<button
							key={key}
							type="button"
							title={t(key)}
							aria-label={t(key)}
							aria-pressed={active}
							disabled={disabled}
							onMouseDown={(e) => e.preventDefault()}
							onClick={run}
							className={cn(
								"text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-40",
								active && "bg-accent text-foreground",
							)}
						>
							<Icon className="size-4" />
						</button>
					))}
				</div>
			))}
		</div>
	);
}
