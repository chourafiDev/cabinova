"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { IconDownload, IconPrinter, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PrintBridge, PrintFormat } from "@/app/(print)/_components/print-bridge";

type OpenPrint = (href: string) => void;

const PrintContext = createContext<OpenPrint | null>(null);

/** "/ordonnances/1?format=a4" → the same page, shown inside the dialog. */
const embedded = (href: string) => {
	const url = new URL(href, window.location.origin);
	url.searchParams.set("embed", "1");
	return `${url.pathname}${url.search}`;
};

/** "Ordonnance Youssef Test" → "Ordonnance Youssef Test.pdf", safe for any system. */
const fileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "document"}.pdf`;

/**
 * Every "Imprimer" of the app opens the document here instead of a new
 * tab: its print page previewed as it will come out, then Annuler,
 * Enregistrer (a PDF, exactly as shown) or Imprimer (the document only).
 * Where the document offers A5 / A4, the choice is in the dialog.
 */
export function PrintDialogProvider({ children }: { children: React.ReactNode }) {
	const t = useTranslations("common.printDialog");
	const frame = useRef<HTMLIFrameElement>(null);
	const [src, setSrc] = useState<string | null>(null);
	const [bridge, setBridge] = useState<PrintBridge | null>(null);
	const [info, setInfo] = useState<{ title: string; formats: PrintFormat[]; current: string | null }>({
		title: "",
		formats: [],
		current: null,
	});
	const [saving, setSaving] = useState(false);

	const open = useCallback<OpenPrint>((href) => {
		setBridge(null);
		setInfo({ title: "", formats: [], current: null });
		setSrc(embedded(href));
	}, []);

	/** The document loaded: wait for its bridge (set once it hydrates), then read it. */
	const onLoad = () => {
		const win = frame.current?.contentWindow;
		if (!win) return;
		// Focus inside the document: Escape still closes the dialog.
		win.addEventListener("keydown", (e) => {
			if (e.key === "Escape") setSrc(null);
		});
		let tries = 0;
		const read = () => {
			const b = win.cabinovaPrint;
			if (!b) {
				if (++tries < 100) setTimeout(read, 50);
				return;
			}
			const formats = b.formats();
			const paper = b.paper();
			setBridge(b);
			setInfo({
				title: b.title(),
				formats,
				current: formats.find((f) => f.label.toLowerCase() === paper)?.label ?? null,
			});
		};
		read();
	};

	const print = () => {
		const win = frame.current?.contentWindow;
		if (!win) return;
		win.focus();
		win.print();
	};

	const save = async () => {
		if (!bridge) return;
		setSaving(true);
		try {
			await bridge.pdf(fileName(info.title));
		} catch {
			toast.error(t("pdfError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<PrintContext.Provider value={open}>
			{children}
			<Dialog open={src !== null} onOpenChange={(next) => !next && !saving && setSrc(null)}>
				<DialogContent className="flex h-[min(94vh,1100px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
					<DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-3 pe-12 text-start">
						<div className="grid min-w-0">
							<DialogTitle className="truncate">{info.title || t("title")}</DialogTitle>
							<DialogDescription className="text-xs">{t("description")}</DialogDescription>
						</div>
						{info.formats.length > 1 && (
							<div className="bg-muted inline-flex rounded-lg p-[3px] text-sm" role="radiogroup" aria-label={t("paper")}>
								{info.formats.map((f) => (
									<button
										key={f.label}
										type="button"
										role="radio"
										aria-checked={f.label === info.current}
										onClick={() => {
											setBridge(null);
											setInfo((i) => ({ ...i, current: f.label }));
											setSrc(embedded(f.href));
										}}
										className={cn(
											"rounded-md px-3 py-1 font-medium",
											f.label === info.current
												? "bg-background shadow-sm"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{f.label}
									</button>
								))}
							</div>
						)}
					</DialogHeader>
					<div className="bg-muted/40 relative min-h-0 flex-1">
						{src && (
							<iframe
								ref={frame}
								key={src}
								src={src}
								title={info.title || t("title")}
								onLoad={onLoad}
								className="size-full border-0"
							/>
						)}
						{!bridge && (
							<div className="bg-muted/40 text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
								<IconSpinner className="size-4 animate-spin" /> {t("loading")}
							</div>
						)}
					</div>
					{/* No padding on this dialog: the footer's usual pull to the edges is cancelled. */}
					<DialogFooter className="mx-0 mb-0 border-t px-5 py-3">
						<Button type="button" variant="ghost" onClick={() => setSrc(null)} disabled={saving}>
							{t("cancel")}
						</Button>
						<Button type="button" variant="outline" onClick={() => void save()} disabled={!bridge || saving}>
							{saving ? <IconSpinner className="animate-spin" /> : <IconDownload />} {t("save")}
						</Button>
						<Button type="button" onClick={print} disabled={!bridge || saving}>
							<IconPrinter /> {t("print")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PrintContext.Provider>
	);
}

/** Opens a document (its print page's address) in the print dialog. */
export function usePrintDialog(): OpenPrint {
	const open = useContext(PrintContext);
	// Outside the provider (a print page itself): a new tab, as before.
	return open ?? ((href) => void window.open(href, "_blank", "noopener"));
}

/**
 * A link to a print page that opens it in the print dialog. Ctrl / ⌘ /
 * middle click still opens the page in a new tab.
 */
export function PrintLink({ href, onClick, ...props }: React.ComponentProps<"a"> & { href: string }) {
	const open = usePrintDialog();
	return (
		<a
			{...props}
			href={href}
			onClick={(e) => {
				onClick?.(e);
				if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
				e.preventDefault();
				open(href);
			}}
		/>
	);
}
