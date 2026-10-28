import { LuArrowRight, LuLandmark } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiCog6Tooth } from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type BillingSettings, formatRib } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { type PlatformSettings, SECTIONS, type SectionKey } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { BrandingSection } from "./_components/branding-section";
import { EmailSection } from "./_components/email-section";
import { GeneralSection } from "./_components/general-section";
import { LanguagesSection } from "./_components/languages-section";
import { NotificationsSection } from "./_components/notifications-section";

export const metadata = { title: "Configuration" };

/**
 * Configuration globale: paramètres généraux, identité visuelle, e-mails,
 * notifications, paiements (→ Facturation), langues. One section at a time
 * (?section=), each saved on its own.
 */
export default async function SettingsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "settings:read")) notFound();
	const raw = (await searchParams).section;
	const section: SectionKey = SECTIONS.some((s) => s.key === raw) ? (raw as SectionKey) : "general";
	const canBilling = can(session.user.permissions, "billing:read");
	const [settings, billing] = await Promise.all([
		apiGet<PlatformSettings>("/settings"),
		section === "payments" && canBilling ? apiGet<BillingSettings>("/billing/settings") : null,
	]);
	const readOnly = !can(session.user.permissions, "settings:write");
	const updated = section !== "payments" ? settings.updatedAt[section] : undefined;

	return (
		<>
			<div className="mb-4 flex items-center gap-2 border-b border-dashed border-foreground/20 pb-4">
				<span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
					<HiCog6Tooth className="size-4" />
				</span>
				<div className="grid leading-tight">
					<h1 className="font-semibold">Configuration</h1>
					<span className="text-xs text-muted-foreground">
						Réglages de toute la plateforme{readOnly ? " — lecture seule" : ""}. Chaque modification est journalisée.
					</span>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
				<nav aria-label="Sections" className="flex gap-1 overflow-x-auto md:sticky md:top-4 md:grid md:overflow-visible">
					{SECTIONS.map((s) => (
						<Link
							key={s.key}
							href={`/settings?section=${s.key}`}
							aria-current={s.key === section ? "page" : undefined}
							scroll={false}
							className={cn(
								"grid shrink-0 rounded-lg px-3 py-2 leading-tight text-muted-foreground hover:bg-muted",
								s.key === section && "bg-muted text-foreground",
							)}
						>
							<span className="text-sm font-medium">{s.label}</span>
							<span className="hidden text-xs text-muted-foreground md:block">{s.hint}</span>
						</Link>
					))}
				</nav>

				<div className="grid max-w-4xl gap-3">
					{section === "general" && <GeneralSection initial={settings.general} readOnly={readOnly} />}
					{section === "branding" && (
						<BrandingSection initial={settings.branding} platformName={settings.general.platformName} readOnly={readOnly} />
					)}
					{section === "email" && <EmailSection initial={settings.email} delivery={settings.delivery} readOnly={readOnly} />}
					{section === "notifications" && <NotificationsSection initial={settings.notifications} readOnly={readOnly} />}
					{section === "languages" && <LanguagesSection initial={settings.languages} readOnly={readOnly} />}
					{section === "payments" && (
						<div className="grid gap-4">
							<div className="grid gap-0.5">
								<h2 className="font-semibold">Paiements</h2>
								<p className="text-sm text-muted-foreground">
									Les cabinets paient par virement sur votre compte ; vous activez l’abonnement à réception.
								</p>
							</div>
							<div className="grid gap-3 rounded-xl border bg-card p-4">
								{billing ? (
									<>
										<div className="flex flex-wrap items-center gap-2">
											<LuLandmark className="size-4 text-muted-foreground" />
											<span className="font-medium">Virement bancaire</span>
											<Badge
												variant="outline"
												className={cn(
													"border-transparent",
													billing.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
												)}
											>
												{billing.configured ? "Configuré" : "À configurer"}
											</Badge>
										</div>
										{billing.configured ? (
											<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
												<dt className="text-muted-foreground">Titulaire</dt>
												<dd>{billing.accountHolder}</dd>
												<dt className="text-muted-foreground">Banque</dt>
												<dd>{billing.bankName}</dd>
												<dt className="text-muted-foreground">RIB</dt>
												<dd className="font-mono">{formatRib(billing.rib)}</dd>
												<dt className="text-muted-foreground">Délais</dt>
												<dd>
													Facture {billing.invoiceDaysBefore} j avant l’échéance · retard après {billing.graceDays} j
												</dd>
											</dl>
										) : (
											<p className="text-sm text-muted-foreground">Sans RIB, les factures partent sans coordonnées bancaires.</p>
										)}
										<Button asChild size="sm" className="w-fit">
											<Link href="/billing/settings">
												Modifier dans Facturation <LuArrowRight />
											</Link>
										</Button>
									</>
								) : (
									<p className="text-sm text-muted-foreground">
										Le RIB et les délais de paiement se règlent dans Facturation → Paramètres (permission « Voir la
										facturation » requise).
									</p>
								)}
							</div>
						</div>
					)}
					{updated && (
						<p className="text-xs text-muted-foreground">
							Dernière modification le {formatDate(updated, { month: "long", hour: "2-digit", minute: "2-digit" })}.
						</p>
					)}
				</div>
			</div>
		</>
	);
}
