import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { FormCard } from "../../_components/shared/form-card";
import { TwoFactorCard } from "./two-factor-card";

export const metadata = { title: "Sécurité du compte" };

type Me = {
	twoFactor: { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number };
	user: { id: string; name: string; email: string; roles: { name: string }[] };
};

/** The signed-in admin's own security: two-factor authentication and sessions. */
export default async function AccountSecurityPage() {
	const session = await getSession();
	if (!session) notFound();
	const me = await apiGet<Me>("/auth/me");

	return (
		<>
			<div className="mb-4 grid gap-0.5 border-b border-dashed border-foreground/20 pb-4 leading-tight">
				<h1 className="font-semibold">Sécurité du compte</h1>
				<span className="text-xs text-muted-foreground">
					{me.user.name} · {me.user.email} · {me.user.roles.map((r) => r.name).join(", ")}
				</span>
			</div>
			<div className="grid max-w-3xl gap-3">
				<TwoFactorCard status={me.twoFactor} />
				<FormCard
					title="Sessions et activité"
					action={
						<Button asChild size="sm" variant="ghost">
							<Link href={`/users/${me.user.id}`}>Voir</Link>
						</Button>
					}
				>
					<p className="text-sm text-muted-foreground">
						Vos appareils connectés et l’historique de votre compte sont sur votre fiche utilisateur ; vous pouvez y
						fermer vos autres sessions.
					</p>
				</FormCard>
			</div>
		</>
	);
}
