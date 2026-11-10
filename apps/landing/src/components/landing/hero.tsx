import { IconArrowRight, IconPlay, IconServer, IconShieldCheck, IconStethoscope } from "@/components/icons";
import { demoHref, TRIAL_DAYS } from "@/lib/site";
import { PhoneMockup } from "./phone-mockup";
import { Accent } from "./section-heading";

const WAITING = ["SA", "OB", "HL"];

/** First screen: the promise, two calls to action, the app on a phone between two cards. */
export function Hero() {
	return (
		<section className="relative overflow-hidden pt-32 sm:pt-40">
			{/* Soft colour fields behind the title. */}
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
				<div className="bg-brand/15 absolute -top-32 left-[8%] h-[30rem] w-[30rem] rounded-full blur-3xl" />
				<div className="bg-highlight/10 absolute top-10 right-[6%] h-[26rem] w-[26rem] rounded-full blur-3xl" />
			</div>

			<div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
				<p className="bg-card/80 text-muted-foreground mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-xs font-medium shadow-sm backdrop-blur sm:text-sm">
					<span className="bg-accent text-primary flex size-6 items-center justify-center rounded-full">
						<IconStethoscope className="size-3.5" />
					</span>
					Conçu pour les cabinets médicaux au Maroc
				</p>
				<h1 className="mx-auto max-w-4xl text-4xl leading-[1.08] font-medium tracking-tight text-balance sm:text-6xl lg:text-7xl">
					Tout votre cabinet médical <Accent>sur un seul écran</Accent>
				</h1>
				<p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base text-pretty sm:text-lg">
					Agenda, salle d’attente, dossiers patients, encaissements et statistiques, pour le médecin et la secrétaire. Dans une base de
					données dédiée à votre cabinet.
				</p>
				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<a
						href={demoHref}
						className="btn-raised bg-primary text-primary-foreground flex h-12 items-center gap-2 rounded-full px-6 font-medium transition hover:-translate-y-0.5"
					>
						Essayer {TRIAL_DAYS} jours gratuitement <IconArrowRight className="size-4 rtl:rotate-180" />
					</a>
					<a href="#comment" className="bg-card hover:bg-muted flex h-12 items-center gap-2 rounded-full border px-6 font-medium transition">
						<IconPlay className="text-primary size-5" /> Comment ça marche
					</a>
				</div>
				<p className="text-muted-foreground mt-4 text-xs">Sans engagement · Paiement par virement · Support en français</p>

				<div className="relative mt-16">
					<PhoneMockup className="translate-y-6" />

					{/* Left card: where the data lives. */}
					<div className="bg-card/90 absolute bottom-24 start-0 hidden w-72 rounded-3xl border p-6 text-start shadow-xl shadow-black/5 backdrop-blur lg:block xl:start-6">
						<span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
							<IconShieldCheck className="size-5" />
						</span>
						<p className="mt-5 text-lg font-medium">Une base par cabinet</p>
						<p className="text-muted-foreground mt-1.5 text-sm">Vos patients ne partagent jamais une table avec ceux d’un autre cabinet.</p>
						<p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
							<IconServer className="text-primary size-4" /> Accès chiffrés · AES-256
						</p>
					</div>

					{/* Right card: the waiting room, live. */}
					<div className="bg-card/90 absolute top-24 end-0 hidden w-72 rounded-3xl border p-6 text-start shadow-xl shadow-black/5 backdrop-blur lg:block xl:end-6">
						<p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Salle d’attente</p>
						<p className="mt-2 text-lg font-medium">3 patients attendent</p>
						<p className="text-muted-foreground mt-1.5 text-sm">La secrétaire les enregistre, le médecin les fait entrer dans l’ordre.</p>
						<div className="mt-4 flex items-center">
							{WAITING.map((w) => (
								<span
									key={w}
									className="bg-accent text-primary border-card -ms-2 flex size-9 items-center justify-center rounded-full border-2 text-[11px] font-semibold first:ms-0"
								>
									{w}
								</span>
							))}
							<span className="text-muted-foreground ms-3 text-xs">Suivant : Salma A.</span>
						</div>
					</div>
				</div>
			</div>
			{/* The phone sinks into the page. */}
			<div aria-hidden className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />
		</section>
	);
}
