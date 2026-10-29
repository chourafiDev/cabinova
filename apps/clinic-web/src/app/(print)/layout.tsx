/** Documents meant for printing / "Save as PDF": no sidebar, white page. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
	return <div className="bg-muted/40 min-h-svh py-8 print:bg-white print:py-0">{children}</div>;
}
