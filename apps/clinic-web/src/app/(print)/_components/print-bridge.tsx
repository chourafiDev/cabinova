"use client";

import { useEffect } from "react";

/** One of the paper sizes a document offers ("A5", "A4"), as its toolbar links them. */
export type PrintFormat = { label: string; href: string };

/** What the print dialog asks the document shown in it. */
export type PrintBridge = {
	/** The document's title, without the app name ("Ordonnance Youssef Test"). */
	title: () => string;
	/** The paper sizes offered (empty when there is only one). */
	formats: () => PrintFormat[];
	/** The paper the document prints on. */
	paper: () => "a4" | "a5";
	/** Downloads the document as a PDF, exactly as it looks. */
	pdf: (fileName: string) => Promise<void>;
};

declare global {
	interface Window {
		cabinovaPrint?: PrintBridge;
	}
}

const paperOf = (): "a4" | "a5" => {
	const css = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
	return /size:\s*A5/i.test(css) ? "a5" : "a4";
};

/**
 * Lets a print page be shown in the print dialog (`?embed=1`): its own
 * toolbar is hidden (the dialog has the buttons), and the dialog can read
 * its title, its paper sizes, and have it saved as a PDF — done here, in
 * the document's own window, so the PDF matches what is on screen.
 */
export function PrintBridgeScript() {
	useEffect(() => {
		if (new URLSearchParams(window.location.search).has("embed")) {
			document.documentElement.dataset.embed = "1";
		}
		window.cabinovaPrint = {
			title: () => document.title.replace(/\s*·\s*Cabinova\s*$/, "").trim(),
			formats: () =>
				[...document.querySelectorAll<HTMLAnchorElement>('a[href*="format="]')].map((a) => ({
					label: a.textContent?.trim() ?? "",
					href: a.href,
				})),
			paper: paperOf,
			pdf: async (fileName) => {
				const sheet = document.querySelector<HTMLElement>("article.paper");
				if (!sheet) throw new Error("No document to save.");
				const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
				// As on paper: no screen shadow, border or rounded corners.
				document.documentElement.dataset.capturing = "1";
				try {
					// JPEG at high quality: sharp text, a few hundred KB (a PNG weighs megabytes in a PDF).
					const image = await toJpeg(sheet, { pixelRatio: 2, quality: 0.92, backgroundColor: "#ffffff", cacheBust: true });
					const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
						const img = new Image();
						img.onload = () => resolve({ width: img.width, height: img.height });
						img.onerror = reject;
						img.src = image;
					});
					const pdf = new jsPDF({ unit: "mm", format: paperOf(), orientation: "portrait", compress: true });
					const pageWidth = pdf.internal.pageSize.getWidth();
					const pageHeight = pdf.internal.pageSize.getHeight();
					const height = (size.height * pageWidth) / size.width;
					// Taller than a sheet (a long invoice): continued on the next pages.
					for (let top = 0, page = 0; top < height - 0.5; top += pageHeight, page++) {
						if (page > 0) pdf.addPage();
						pdf.addImage(image, "JPEG", 0, -top, pageWidth, height, "sheet", "FAST");
					}
					pdf.save(fileName);
				} finally {
					delete document.documentElement.dataset.capturing;
				}
			},
		};
		return () => {
			delete window.cabinovaPrint;
		};
	}, []);
	return null;
}
