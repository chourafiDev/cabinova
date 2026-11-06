"use client";

import { IconPrinter } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function PrintButton() {
	return (
		<Button onClick={() => window.print()} className="print:hidden">
			<IconPrinter /> Imprimer / PDF
		</Button>
	);
}
