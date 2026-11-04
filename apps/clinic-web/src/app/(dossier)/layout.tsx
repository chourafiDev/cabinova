import { redirect } from "next/navigation";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { CurrentUserProvider } from "@/components/current-user";
import { getClinicState } from "@/lib/session";

/**
 * The doctor's workspace: full screen, no sidebar, so the patient takes the
 * whole page. Same session rules as the clinic pages.
 */
export default async function DossierLayout({ children }: { children: React.ReactNode }) {
	const state = await getClinicState();
	if (state.status === "unavailable") return <CabinetUnavailable reason={state.reason} />;
	if (state.status === "signed-out") redirect("/login");
	const { session } = state;
	if (session.user.twoFactorSetupRequired) redirect("/securite");

	return (
		<CurrentUserProvider user={{ id: session.user.id, name: session.user.name, role: session.user.role }}>
			<div className="bg-muted/30 min-h-svh">{children}</div>
		</CurrentUserProvider>
	);
}
