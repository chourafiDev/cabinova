import { LuLifeBuoy } from "react-icons/lu";
import { Button } from "@/components/ui/button";

/** Support card at the bottom of the sidebar; hidden when collapsed to icons. */
export function HelpCard() {
	return (
		<div className="group-data-[collapsible=icon]:hidden rounded-xl bg-brand p-3">
			<div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white/15 text-white">
				<LuLifeBuoy className="size-4" />
			</div>
			<p className="text-sm font-medium text-white">Besoin d&apos;aide ?</p>
			<p className="mt-0.5 text-xs text-white/70">L&apos;équipe Cabinova répond à vos questions.</p>
			<Button asChild size="sm" variant="outline" className="mt-3 w-full bg-sidebar">
				<a href="mailto:support@cabinova.ma">Contacter le support</a>
			</Button>
		</div>
	);
}
