import { notFound } from "next/navigation";
import { HiCog6Tooth } from "react-icons/hi2";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "settings:read")) notFound();

	return (
		<>
			<div className="mb-4 flex items-center gap-2 border-b border-dashed border-foreground/20 pb-4">
				<div className="bg-primary/10 size-8 rounded-md flex items-center justify-center">
					<HiCog6Tooth className="text-primary size-3.5" />
				</div>
				<h1 className="text-foreground text-sm font-medium">Réglages</h1>
			</div>
			<p className="text-muted-foreground text-sm">
				Horaires de la clinique, logo, et modèles de consultation par spécialité — à venir.
			</p>
		</>
	);
}
