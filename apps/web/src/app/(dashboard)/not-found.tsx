import Link from "next/link";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { Button } from "@/components/ui/button";

// Shown inside the dashboard layout when a page calls notFound()
// (e.g. a deleted patient or an unknown id).
export default function DashboardNotFound() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
			<div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
				<HiMagnifyingGlass className="size-5" />
			</div>
			<h1 className="text-lg font-semibold">Page introuvable</h1>
			<p className="text-muted-foreground max-w-sm text-sm">
				Cet élément n&apos;existe pas ou a été supprimé. Vérifiez le lien ou revenez au tableau de bord.
			</p>
			<Button asChild className="mt-2">
				<Link href="/">Retour au tableau de bord</Link>
			</Button>
		</div>
	);
}
