import { LuArrowRight, LuBanknote, LuCalendarCheck, LuCirclePlay, LuSparkles, LuUserX } from "react-icons/lu";
import { FlipWords } from "@/components/ui/flip-words";
import { Spotlight } from "@/components/ui/spotlight-new";
import { demoHref, TRIAL_DAYS } from "@/lib/site";
import { cn } from "@/lib/utils";

const MONTHS = [
	{ label: "Mai", value: 52 },
	{ label: "Juin", value: 61 },
	{ label: "Juil.", value: 48 },
	{ label: "Août", value: 57 },
	{ label: "Sept.", value: 74 },
	{ label: "Oct.", value: 88 },
];
const WAITING = [
	{ initials: "SA", name: "Salma A.", time: "10:30" },
	{ initials: "OB", name: "Omar B.", time: "11:00" },
	{ initials: "HL", name: "Houda L.", time: "11:30" },
];

/** First screen: the promise, the two calls to action, a glimpse of the app. */
export function Hero() {
	return (
		<section className="relative overflow-hidden pt-28 pb-16 sm:pt-36">
			{/* Soft grid and plum glow, as in the reference design. */}
			<div
				aria-hidden
				className="absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] opacity-70"
			/>
			<div aria-hidden className="bg-brand/20 absolute -top-40 left-1/2 -z-10 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full blur-3xl" />
			<Spotlight
				gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgb(97 63 117 / 0.10) 0, rgb(97 63 117 / 0.03) 50%, transparent 80%)"
				gradientSecond="radial-gradient(50% 50% at 50% 50%, rgb(97 63 117 / 0.07) 0, rgb(97 63 117 / 0.02) 80%, transparent 100%)"
				gradientThird="radial-gradient(50% 50% at 50% 50%, rgb(97 63 117 / 0.05) 0, rgb(97 63 117 / 0.02) 80%, transparent 100%)"
			/>

			<div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
				<p className="bg-card/70 text-muted-foreground mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur sm:text-sm">
					<LuSparkles className="text-primary size-3.5" />
					Conçu pour les cabinets médicaux au Maroc
				</p>
				<h1 className="mx-auto max-w-4xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl">
					Votre cabinet médical,
					<br className="hidden sm:block" /> enfin simple à
					<FlipWords words={["organiser", "gérer", "piloter"]} className="text-primary px-2" />
				</h1>
				<p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base text-pretty sm:text-lg">
					Agenda, dossiers patients, encaissements et statistiques : tout le cabinet sur un seul écran, pour le médecin
					et la secrétaire. Dans une base de données dédiée à votre cabinet.
				</p>
				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<a
						href={demoHref}
						className="btn-raised bg-primary text-primary-foreground flex h-12 items-center gap-2 rounded-full px-6 font-medium transition hover:-translate-y-0.5 hover:opacity-95"
					>
						Essayer {TRIAL_DAYS} jours gratuitement <LuArrowRight className="size-4" />
					</a>
					<a href="#fonctionnalites" className="bg-card hover:bg-muted flex h-12 items-center gap-2 rounded-full border px-6 font-medium transition">
						<LuCirclePlay className="size-4" /> Découvrir l’application
					</a>
				</div>
				<p className="text-muted-foreground mt-4 text-xs">Sans engagement · Paiement par virement · Support en français</p>

				<HeroPreview />
			</div>
		</section>
	);
}

/** A stylised view of the clinic app (decorative; the figures are examples). */
function HeroPreview() {
	const max = Math.max(...MONTHS.map((m) => m.value));
	return (
		<div className="relative mx-auto mt-14 max-w-5xl" aria-hidden>
			<div className="from-brand/15 absolute -inset-x-8 -inset-y-6 -z-10 rounded-[2.5rem] bg-gradient-to-b to-transparent blur-2xl" />
			<div className="bg-card/80 grid gap-3 rounded-3xl border p-3 text-start shadow-2xl shadow-black/5 backdrop-blur sm:grid-cols-4 sm:p-4">
				<div className="grid gap-3">
					<Tile icon={LuCalendarCheck} label="Rendez-vous aujourd’hui" value="18" badge="+3" />
					<Tile icon={LuBanknote} label="Encaissé ce mois" value="48 750 MAD" className="hidden sm:block" />
				</div>

				<div className="bg-card rounded-2xl border p-4 sm:col-span-2">
					<div className="flex items-baseline justify-between">
						<p className="text-muted-foreground text-xs">Consultations</p>
						<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
							+19 %
						</span>
					</div>
					<p className="mt-1 text-2xl font-semibold">380</p>
					<p className="text-muted-foreground text-[11px]">6 derniers mois</p>
					<div className="mt-4 flex h-32 items-end gap-3">
						{MONTHS.map((m, i) => (
							<div key={m.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
								<div className="flex w-full flex-1 items-end">
									<div
										className={
											i === MONTHS.length - 1
												? "bg-brand w-full rounded-t-md"
												: "w-full rounded-t-md bg-[repeating-linear-gradient(135deg,var(--brand-soft)_0_6px,transparent_6px_10px)] ring-1 ring-[var(--brand-soft)] ring-inset"
										}
										style={{ height: `${(m.value / max) * 100}%` }}
									/>
								</div>
								<span className="text-muted-foreground text-[10px]">{m.label}</span>
							</div>
						))}
					</div>
				</div>

				<div className="grid gap-3">
					<div className="bg-brand rounded-2xl p-4 text-white">
						<p className="text-xs text-white/70">Salle d’attente</p>
						<p className="mt-1 text-2xl font-semibold">3 patients</p>
						<ul className="mt-3 grid gap-2">
							{WAITING.map((w) => (
								<li key={w.name} className="flex items-center gap-2 text-xs">
									<span className="flex size-6 items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold">{w.initials}</span>
									<span className="flex-1">{w.name}</span>
									<span className="text-white/60 tabular-nums">{w.time}</span>
								</li>
							))}
						</ul>
					</div>
					<Tile icon={LuUserX} label="Taux d’absence" value="4,1 %" badge="−2 pts" className="hidden sm:block" />
				</div>
			</div>
		</div>
	);
}

function Tile({
	icon: Icon,
	label,
	value,
	badge,
	className,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	badge?: string;
	className?: string;
}) {
	return (
		<div className={cn("bg-card rounded-2xl border p-4", className)}>
			<span className="bg-accent text-primary flex size-8 items-center justify-center rounded-lg">
				<Icon className="size-4" />
			</span>
			<p className="text-muted-foreground mt-3 text-xs">{label}</p>
			<div className="mt-0.5 flex items-baseline justify-between gap-2">
				<p className="text-xl font-semibold">{value}</p>
				{badge && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{badge}</span>}
			</div>
		</div>
	);
}
