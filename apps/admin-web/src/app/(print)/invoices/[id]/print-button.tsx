"use client";

import { LuPrinter } from "react-icons/lu";
import { Button } from "@/components/ui/button";

export function PrintButton() {
	return (
		<Button onClick={() => window.print()} className="print:hidden">
			<LuPrinter /> Imprimer / PDF
		</Button>
	);
}
