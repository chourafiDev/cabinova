import Link from "next/link";
import { LuArrowRight, LuBanknote, LuBuilding2, LuCalendarDays, LuChartColumn, LuCreditCard, LuLifeBuoy, LuRocket, LuShieldCheck, LuUsers } from "react-icons/lu";
import { DocsSearchButton } from "@/components/docs/docs-search";
import { DOCS } from "@/lib/docs-nav";

const ICONS = {
	Démarrer: LuRocket,
	Agenda: LuCalendarDays,
	Patients: LuUsers,
	Encaissements: LuBanknote,
	Pilotage: LuChartColumn,
	"Votre cabinet": LuBuilding2,
	Sécurité: LuShieldCheck,
	Abonnement: LuCreditCard,
	Aide: LuLifeBuoy,
} as const;

const SUMMARIES: Record<string, string> = {
	Démarrer: "Découvrir Cabinova, préparer le cabinet et comprendre les rôles.",
	Agenda: "Planifier les rendez-vous et suivre la salle d’attente.",
	Patients: "Tenir les dossiers administratifs et médicaux.",
	Encaissements: "Encaisser les visites, imprimer les reçus et clôturer la caisse.",
	Pilotage: "Suivre l’activité du cabinet, au jour le jour et dans la durée.",
	"Votre cabinet": "Configurer l’équipe, les sites et les tarifs.",
	Sécurité: "Protéger les comptes et comprendre où vont vos données.",
	Abonnement: "Offres, devis, factures et renouvellement.",
	Aide: "Trouver une réponse ou écrire au support.",
};

const POPULAR = ["agenda/prendre-rendez-vous", "encaissements/encaisser", "cabinet/equipe", "abonnement/passer-a-une-offre"];

export default function DocsHome() {
	const pages = DOCS.flatMap((section) => section.pages);
	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
			<p className="text-primary text-sm font-medium">Documentation</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Tout pour utiliser Cabinova au quotidien</h1>
			<p className="text-muted-foreground mt-3 max-w-2xl text-lg text-pretty">
				Des guides simples pour le médecin et la secrétaire : de la première connexion à la clôture de caisse.
			</p>
			<div className="mt-6 max-w-md">
				<DocsSearchButton large />
			</div>

			<section aria-labelledby="popular" className="mt-12">
				<h2 id="popular" className="text-muted-foreground text-sm font-medium">
					Les guides les plus utiles
				</h2>
				<ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
					{POPULAR.map((slug) => {
						const page = pages.find((p) => p.slug === slug)!;
						return (
							<li key={slug}>
								<Link href={`/docs/${slug}`} className="group hover:text-primary flex items-center gap-2 py-1 font-medium">
									{page.title}
									<LuArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
								</Link>
							</li>
						);
					})}
				</ul>
			</section>

			<section aria-labelledby="all" className="mt-12">
				<h2 id="all" className="text-xl font-semibold tracking-tight">
					Parcourir par sujet
				</h2>
				<ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{DOCS.map((section) => {
						const Icon = ICONS[section.title as keyof typeof ICONS];
						return (
							<li key={section.title}>
								<Link
									href={`/docs/${section.pages[0].slug}`}
									className="bg-card hover:border-primary/50 focus-visible:outline-primary flex h-full flex-col gap-2 rounded-xl border p-5 transition-colors focus-visible:outline-2"
								>
									<span className="bg-accent text-primary flex size-9 items-center justify-center rounded-lg">
										<Icon className="size-[1.125rem]" />
									</span>
									<span className="mt-1 font-semibold">{section.title}</span>
									<span className="text-muted-foreground text-sm text-pretty">{SUMMARIES[section.title]}</span>
									<span className="text-muted-foreground mt-auto pt-2 text-xs">
										{section.pages.length} {section.pages.length > 1 ? "guides" : "guide"}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</section>
		</main>
	);
}
