import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { serverApi } from "@/lib/server-api";
import { getCabinet } from "@/lib/session";
import { AuthCard } from "../../_components/auth-card";
import { AcceptInvitationForm } from "./accept-invitation-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("invite.meta") };
}

type Invitation = { name: string; email: string; reset: boolean };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
	const { token } = await params;
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;
	const t = await getTranslations("auth.invite");

	const res = await serverApi(`/auth/invitations/${encodeURIComponent(token)}`);
	if (!res.ok) {
		return (
			<AuthCard
				cabinet={found.cabinet}
				title={t("invalidTitle")}
				description={t("invalidDescription")}
			>
				<p className="mt-8 flex justify-center gap-6 text-sm">
					<Link href="/forgot-password" className="font-medium hover:underline">
						{t("forgot")}
					</Link>
					<Link href="/login" className="font-medium hover:underline">
						{t("toLogin")}
					</Link>
				</p>
			</AuthCard>
		);
	}
	const invitation: Invitation = await res.json();

	return (
		<AuthCard
			cabinet={found.cabinet}
			title={invitation.reset ? t("resetTitle") : t("welcome", { name: invitation.name })}
			description={
				invitation.reset
					? t("resetDescription")
					: t("welcomeDescription", { cabinet: found.cabinet.name })
			}
		>
			<AcceptInvitationForm token={token} email={invitation.email} />
		</AuthCard>
	);
}
