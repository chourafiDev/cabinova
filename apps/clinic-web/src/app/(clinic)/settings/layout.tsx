import { HiCog6Tooth } from "react-icons/hi2";
import { getClinicState } from "@/lib/session";
import { SETTINGS_SECTIONS } from "@/lib/settings";
import { SettingsNav } from "./_components/settings-nav";

/** Paramètres: a section list beside the current section (one page each). */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
	const state = await getClinicState();
	const isOwner = state.status === "signed-in" && state.session.user.role === "owner";
	const sections = SETTINGS_SECTIONS.filter((s) => isOwner || !s.ownerOnly);

	return (
		<div className="grid gap-4">
			<header className="flex items-center gap-3">
				<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
					<HiCog6Tooth className="size-4" />
				</span>
				<div>
					<h1 className="text-lg font-semibold leading-tight">Paramètres</h1>
					<p className="text-muted-foreground text-sm">
						{isOwner ? "Votre compte, le cabinet, ses espaces et son agenda." : "Votre compte et vos appareils."}
					</p>
				</div>
			</header>
			<div className="grid gap-4 md:grid-cols-[210px_minmax(0,1fr)] md:items-start">
				<SettingsNav sections={sections} />
				<div className="grid max-w-3xl gap-4">{children}</div>
			</div>
		</div>
	);
}
