import { LuCalendarCheck, LuMailOpen, LuSettings2, LuStethoscope } from "react-icons/lu";
import { TRIAL_DAYS } from "@/lib/site";
import { SectionHeading } from "./section-heading";

const STEPS = [
	{
		icon: LuMailOpen,
		title: "Votre cabinet est créé",
		description: "Vous recevez l’adresse de votre cabinet (votre-cabinet.cabinova.ma) et un lien pour choisir votre mot de passe.",
	},
	{
		icon: LuSettings2,
		title: "Vous le paramétrez",
		description: "Horaires d’ouverture, durée des rendez-vous, tarifs des actes, sites : tout se règle depuis les Paramètres.",
	},
	{
		icon: LuCalendarCheck,
		title: "Votre équipe vous rejoint",
		description: "Invitez votre secrétaire et vos confrères par e-mail ou WhatsApp ; chacun choisit son mot de passe.",
	},
	{
		icon: LuStethoscope,
		title: "Vous recevez vos patients",
		description: "Agenda, salle d’attente, dossiers et encaissements sont prêts. Vos statistiques se remplissent d’elles-mêmes.",
	},
];

/** From the first e-mail to the first patient, in four steps. */
export function HowItWorks() {
	return (
		<section id="comment" className="bg-muted/50 border-y py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Comment ça marche"
					title="Opérationnel dès le premier jour"
					description={`Pas d’installation, pas de serveur : Cabinova fonctionne dans le navigateur, sur ordinateur comme sur tablette. ${TRIAL_DAYS} jours d’essai pour tout découvrir.`}
				/>
				<ol className="relative mt-14 grid gap-6 md:grid-cols-4">
					<span aria-hidden className="via-primary/30 absolute top-6 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block" />
					{STEPS.map((step, i) => (
						<li key={step.title} className="relative flex flex-col items-center text-center md:items-start md:text-start">
							<span className="bg-card text-primary relative z-10 flex size-12 items-center justify-center rounded-2xl border shadow-sm">
								<step.icon className="size-5" />
							</span>
							<span className="text-primary mt-5 text-xs font-semibold tracking-wider">ÉTAPE {i + 1}</span>
							<h3 className="mt-1 text-lg font-semibold tracking-tight">{step.title}</h3>
							<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.description}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
