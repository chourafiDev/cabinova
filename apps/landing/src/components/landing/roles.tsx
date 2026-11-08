import { type AppIcon, IconArrowRight, IconCheck, IconProfile, IconStethoscope } from "@/components/icons";
import { demoHref } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Accent } from "./section-heading";

const ROLES: { icon: AppIcon; title: string; points: string[]; className?: string }[] = [
	{
		icon: IconStethoscope,
		title: "Le médecin",
		points: ["Antécédents et constantes", "Ordonnances et certificats", "Statistiques et chiffre d’affaires"],
	},
	{
		icon: IconProfile,
		title: "La secrétaire",
		points: ["Agenda et salle d’attente", "Dossiers administratifs", "Encaissements et reçus"],
		className: "md:translate-y-10",
	},
];

/** A grey band: one app, two jobs, each with its own view. */
export function Roles() {
	return (
		<section className="bg-muted/60 border-y py-20 sm:py-24">
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
				<div>
					<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
						Chacun son rôle, <Accent>un seul cabinet</Accent>
					</h2>
					<p className="text-muted-foreground mt-4 max-w-md text-base text-pretty sm:text-lg">
						Le médecin et la secrétaire travaillent sur le même agenda. Chacun voit ce dont il a besoin, rien de plus.
					</p>
					<a
						href={demoHref}
						className="btn-raised bg-primary text-primary-foreground mt-8 inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium"
					>
						Demander une démo <IconArrowRight className="size-4 rtl:rotate-180" />
					</a>
				</div>
				<ul className="grid gap-4 pb-10 md:grid-cols-2">
					{ROLES.map((r) => (
						<li key={r.title} className={cn("bg-card rounded-3xl border p-7 shadow-sm", r.className)}>
							<span className="bg-accent text-primary flex size-11 items-center justify-center rounded-2xl">
								<r.icon className="size-5" />
							</span>
							<h3 className="mt-6 text-2xl font-medium">{r.title}</h3>
							<ul className="mt-4 grid gap-2.5 text-sm">
								{r.points.map((p) => (
									<li key={p} className="flex items-center gap-2.5">
										<span className="bg-accent text-primary flex size-5 items-center justify-center rounded-full">
											<IconCheck className="size-3" />
										</span>
										{p}
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
