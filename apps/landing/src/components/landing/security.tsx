import type { IconType } from "react-icons";
import { LuDatabase, LuEyeOff, LuHistory, LuKeyRound, LuLayers, LuMonitorSmartphone } from "react-icons/lu";
import { BackgroundBeams } from "@/components/ui/background-beams";

const POINTS: { icon: IconType; title: string; description: string }[] = [
	{
		icon: LuDatabase,
		title: "Une base de données par cabinet",
		description: "Vos patients ne partagent jamais une table avec ceux d’un autre cabinet.",
	},
	{
		icon: LuKeyRound,
		title: "Accès chiffrés",
		description: "Les identifiants de votre base sont chiffrés (AES-256), les mots de passe jamais stockés en clair.",
	},
	{
		icon: LuEyeOff,
		title: "Le secret médical respecté",
		description: "Les antécédents ne sont visibles que par les médecins ; les chiffres, que par le responsable.",
	},
	{
		icon: LuLayers,
		title: "Sites cloisonnés",
		description: "Chaque espace ne voit que ses propres patients, rendez-vous et encaissements.",
	},
	{
		icon: LuMonitorSmartphone,
		title: "Appareils sous contrôle",
		description: "Voyez où vous êtes connecté et déconnectez un appareil perdu à distance.",
	},
	{
		icon: LuHistory,
		title: "Rien ne s’efface",
		description: "Paiements annulés avec un motif, dossiers archivés plutôt que supprimés.",
	},
];

/** Why a cabinet can trust Cabinova with its patients' data. */
export function Security() {
	return (
		<section id="securite" className="py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="bg-ink relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-14 text-white sm:px-12 sm:py-16">
					<BackgroundBeams className="opacity-60" />
					<div className="relative z-10">
						<p className="mb-4 w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">Sécurité</p>
						<h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
							Les données de vos patients, protégées comme il se doit
						</h2>
						<p className="mt-4 max-w-2xl text-white/70">
							Cabinova a été pensé dès le départ pour le secret médical : isolation, chiffrement et droits d’accès par rôle.
						</p>
						<ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{POINTS.map((p) => (
								<li key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
									<span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
										<p.icon className="size-4" />
									</span>
									<h3 className="mt-4 font-semibold">{p.title}</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-white/65">{p.description}</p>
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
