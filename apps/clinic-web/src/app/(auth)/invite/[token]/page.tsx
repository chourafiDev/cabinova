import type { Metadata } from "next";
import Link from "next/link";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { serverApi } from "@/lib/server-api";
import { getCabinet } from "@/lib/session";
import { AuthCard } from "../../_components/auth-card";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

type Invitation = { name: string; email: string };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
	const { token } = await params;
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;

	const res = await serverApi(`/auth/invitations/${encodeURIComponent(token)}`);
	if (!res.ok) {
		return (
			<AuthCard
				cabinet={found.cabinet}
				title="Lien invalide ou expiré"
				description="Ce lien a déjà servi ou n’est plus valable. Demandez-en un nouveau au médecin responsable du cabinet, ou au support Cabinova."
			>
				<p className="mt-8 text-center text-sm">
					<Link href="/login" className="font-medium hover:underline">
						Aller à la connexion
					</Link>
				</p>
			</AuthCard>
		);
	}
	const invitation: Invitation = await res.json();

	return (
		<AuthCard
			cabinet={found.cabinet}
			title={`Bienvenue, ${invitation.name}`}
			description={`Choisissez votre mot de passe pour accéder à l’espace du ${found.cabinet.name}.`}
		>
			<AcceptInvitationForm token={token} email={invitation.email} />
		</AuthCard>
	);
}
