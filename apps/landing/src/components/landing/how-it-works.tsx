import { IconCalendarCheck, IconMail, IconSettings, IconStethoscope } from "@/components/icons";
import { TRIAL_DAYS } from "@/lib/site";
import { Accent, SectionHeading } from "./section-heading";

const STEPS = [
	{
		icon: IconMail,
		title: "Votre cabinet est créé",
		description: "Vous recevez son adresse (votre-cabinet.cabinova.ma) et un lien pour choisir votre mot de passe.",
	},
	{
		icon: IconSettings,
		title: "Vous le paramétrez",
		description: "Horaires, durée des rendez-vous, tarifs des actes et sites se règlent depuis les Paramètres.",
	},
	{
		icon: IconCalendarCheck,
		title: "Votre équipe vous rejoint",
		description: "Invitez secrétaire et confrères par e-mail ou WhatsApp ; chacun choisit son mot de passe.",
	},
	{
		icon: IconStethoscope,
		title: "Vous recevez vos patients",
		description: "Agenda, salle d’attente, dossiers et encaissements sont prêts. Les statistiques se remplissent seules.",
	},
];

/** From the first e-mail to the first patient: four columns between thin rules. */
export function HowItWorks() {
	return (
		<section id="comment" className="py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					title={
						<>
							Opérationnel <Accent>en quatre étapes</Accent>
						</>
					}
					description={`Nous créons votre cabinet et vous accompagnons pour la prise en main. ${TRIAL_DAYS} jours d’essai pour tout découvrir.`}
				/>
				<ol className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
					{STEPS.map((step, i) => (
						<li key={step.title} className="border-s px-6">
							<span className="text-primary flex items-center gap-3">
								<step.icon className="size-7" />
								<span className="text-xs font-semibold tracking-wider">ÉTAPE {i + 1}</span>
							</span>
							<h3 className="mt-6 text-xl font-medium tracking-tight">{step.title}</h3>
							<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.description}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
