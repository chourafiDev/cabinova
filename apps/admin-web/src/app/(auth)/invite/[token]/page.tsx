import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { getTenant } from "@/lib/session";
import { AuthCard } from "../../_components/auth-card";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

type Invitation = { name: string; email: string; isReset: boolean };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
	const { token } = await params;
	const tenant = await getTenant();
	if (!tenant) {
		return (
			<AuthCard
				tenantName="Cabinova"
				title="Clinique introuvable"
				description="Vérifiez l'adresse du lien que vous avez reçu."
			/>
		);
	}

	const res = await serverApi(`/auth/invitations/${encodeURIComponent(token)}`);
	if (!res.ok) {
		return (
			<AuthCard
				tenantName={tenant.name}
				title="Lien invalide ou expiré"
				description="Demandez un nouveau lien à l'administrateur de la clinique."
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
			tenantName={tenant.name}
			title={invitation.isReset ? "Nouveau mot de passe" : `Bienvenue, ${invitation.name}`}
			description={
				invitation.isReset
					? `Choisissez un nouveau mot de passe pour ${invitation.email}.`
					: `Choisissez votre mot de passe pour rejoindre ${tenant.name}.`
			}
		>
			<AcceptInvitationForm token={token} email={invitation.email} />
		</AuthCard>
	);
}
