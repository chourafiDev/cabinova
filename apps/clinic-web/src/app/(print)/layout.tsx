import { PrintBridgeScript } from "./_components/print-bridge";

/**
 * Documents meant for printing / "Save as PDF": no sidebar, white page.
 * Also shown inside the app's print dialog (?embed=1).
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="bg-muted/40 min-h-svh py-8 print:bg-white print:py-0">
			<PrintBridgeScript />
			{children}
		</div>
	);
}
