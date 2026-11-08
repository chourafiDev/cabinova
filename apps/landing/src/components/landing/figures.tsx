import { IconClock, IconLanguage, IconStethoscope } from "@/components/icons";
import { CountUp } from "@/components/ui/count-up";
import { TRIAL_DAYS } from "@/lib/site";
import { Accent } from "./section-heading";

const FIGURES = [
	{ value: TRIAL_DAYS, unit: "jours", label: "d’essai gratuit, sans engagement", detail: "Votre cabinet est créé en quelques minutes.", icon: IconClock },
	{ value: 12, unit: "+", label: "spécialités prises en charge", detail: "De la médecine générale à la kinésithérapie.", icon: IconStethoscope },
	{ value: 2, unit: "langues", label: "français et arabe", detail: "L’arabe s’affiche de droite à gauche.", icon: IconLanguage },
];

/** The heading split in two, then three figures. */
export function Figures() {
	return (
		<section className="py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
					<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
						Un cabinet mieux organisé, <Accent>dès le premier jour</Accent>
					</h2>
					<p className="text-muted-foreground text-base text-pretty sm:text-lg">
						Pas d’installation ni de serveur : Cabinova fonctionne dans le navigateur, sur ordinateur comme sur tablette.
					</p>
				</div>
				<ul className="mt-12 grid gap-4 md:grid-cols-3">
					{FIGURES.map((f) => (
						<li key={f.label} className="bg-card relative overflow-hidden rounded-3xl border p-7">
							<f.icon aria-hidden className="text-primary/10 absolute -end-6 -bottom-6 size-36" />
							<p className="flex items-baseline gap-1.5">
								<CountUp to={f.value} className="text-5xl font-medium tracking-tight" />
								<span className="text-primary text-2xl font-medium">{f.unit}</span>
							</p>
							<p className="mt-3 font-medium">{f.label}</p>
							<p className="text-muted-foreground mt-1 text-sm">{f.detail}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
