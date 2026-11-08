import { type AppIcon, IconCalendar, IconChart, IconClipboard, IconLocation, IconReceipt } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Accent, SectionHeading } from "./section-heading";

type Feature = { icon: AppIcon; title: string; description: string; visual: React.ReactNode };

const MAIN: Feature[] = [
	{
		icon: IconCalendar,
		title: "Agenda et salle d’attente",
		description: "Prenez les rendez-vous en quelques clics, suivez l’arrivée des patients et faites-les entrer dans l’ordre.",
		visual: <AgendaVisual />,
	},
	{
		icon: IconChart,
		title: "Statistiques",
		description: "Consultations, nouveaux patients, absences, affluence et chiffre d’affaires, comparés à la période précédente.",
		visual: <StatsVisual />,
	},
];

const MORE: Feature[] = [
	{
		icon: IconClipboard,
		title: "Dossiers patients",
		description: "Identité, couverture (CNSS, CNOPS, AMO…), antécédents et ordonnances, retrouvés par nom, téléphone ou CIN.",
		visual: <SearchVisual />,
	},
	{
		icon: IconReceipt,
		title: "Encaissements et reçus",
		description: "Paiements partiels, reçus numérotés avec le montant en lettres, clôture de caisse le soir.",
		visual: <ReceiptVisual />,
	},
	{
		icon: IconLocation,
		title: "Plusieurs sites",
		description: "Chaque espace garde ses patients, son agenda et son équipe ; le responsable voit tout.",
		visual: <SitesVisual />,
	},
];

/** What the app does: two large cards, then three. */
export function Features() {
	return (
		<section id="fonctionnalites" className="py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					title={
						<>
							Tout le cabinet, <Accent>du rendez-vous au reçu</Accent>
						</>
					}
					description="Une seule application pour l’accueil, la consultation et la gestion, pensée avec des médecins et des secrétaires."
				/>
				<ul className="mt-14 grid gap-4 md:grid-cols-2">
					{MAIN.map((f) => (
						<Card key={f.title} feature={f} large />
					))}
				</ul>
				<ul className="mt-4 grid gap-4 md:grid-cols-3">
					{MORE.map((f) => (
						<Card key={f.title} feature={f} />
					))}
				</ul>
			</div>
		</section>
	);
}

function Card({ feature: f, large }: { feature: Feature; large?: boolean }) {
	return (
		<li className="bg-muted/60 flex flex-col overflow-hidden rounded-3xl border p-6 sm:p-8">
			<h3 className={cn("flex items-center gap-2.5 font-medium tracking-tight", large ? "text-2xl" : "text-xl")}>
				<f.icon className="text-primary size-6 shrink-0" /> {f.title}
			</h3>
			<p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">{f.description}</p>
			<div className="bg-card mt-8 flex flex-1 flex-col justify-center rounded-2xl border p-4 shadow-sm" aria-hidden>
				{f.visual}
			</div>
		</li>
	);
}

/** A day column of the agenda, in the status colours of the app. */
function AgendaVisual() {
	const slots = [
		{ time: "09:00", name: "Amina F.", reason: "Contrôle tension", tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", status: "Terminé" },
		{ time: "09:30", name: "Youssef B.", reason: "Fièvre et toux", tone: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200", status: "En salle" },
		{ time: "10:00", name: "Khadija E.", reason: "Bilan annuel", tone: "bg-purple-50 text-purple-800 dark:bg-purple-500/15 dark:text-purple-200", status: "Confirmé" },
		{ time: "10:30", name: "Mehdi T.", reason: "Certificat médical", tone: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", status: "Prévu" },
	];
	return (
		<div className="grid gap-2">
			{slots.map((s) => (
				<div key={s.time} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-xs">
					<span className="text-muted-foreground w-10 tabular-nums">{s.time}</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium">{s.name}</span>
						<span className="text-muted-foreground block truncate">{s.reason}</span>
					</span>
					<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", s.tone)}>{s.status}</span>
				</div>
			))}
		</div>
	);
}

/** Consultations over six months. */
function StatsVisual() {
	const months = [
		["Mai", 52],
		["Juin", 61],
		["Juil.", 48],
		["Août", 57],
		["Sept.", 74],
		["Oct.", 88],
	] as const;
	return (
		<div>
			<div className="flex items-baseline justify-between">
				<p className="text-2xl font-semibold">380</p>
				<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
					+19 %
				</span>
			</div>
			<p className="text-muted-foreground text-[11px]">Consultations · 6 derniers mois</p>
			<div className="mt-4 flex h-32 items-end gap-3">
				{months.map(([label, value], i) => (
					<div key={label} className="flex h-full flex-1 flex-col items-center gap-1.5">
						<div className="flex w-full flex-1 items-end">
							<div
								className={cn("w-full rounded-t-[4px]", i === months.length - 1 ? "bg-brand" : "bg-brand/25")}
								style={{ height: `${(value / 88) * 100}%` }}
							/>
						</div>
						<span className="text-muted-foreground text-[10px]">{label}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function SearchVisual() {
	return (
		<div className="grid gap-2 text-xs">
			<p className="bg-muted text-muted-foreground rounded-lg px-3 py-2">Rechercher : « 0661 »</p>
			{[
				["Amina F.", "0661 23 45 67 · CNOPS"],
				["Omar B.", "0661 98 12 30 · AMO"],
			].map(([name, detail]) => (
				<p key={name} className="rounded-lg border px-3 py-2">
					<span className="block font-medium">{name}</span>
					<span className="text-muted-foreground">{detail}</span>
				</p>
			))}
		</div>
	);
}

function ReceiptVisual() {
	return (
		<div className="text-xs">
			<div className="flex justify-between">
				<span className="font-medium">Reçu n° 2026-0418</span>
				<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
					Payé
				</span>
			</div>
			<p className="mt-3 flex justify-between">
				<span className="text-muted-foreground">Consultation</span> 300 MAD
			</p>
			<p className="mt-1 flex justify-between">
				<span className="text-muted-foreground">ECG</span> 200 MAD
			</p>
			<p className="mt-3 flex justify-between border-t pt-2 font-semibold">
				<span>Total</span> 500 MAD
			</p>
			<p className="text-muted-foreground mt-1 italic">Cinq cents dirhams</p>
		</div>
	);
}

function SitesVisual() {
	return (
		<div className="grid gap-2 text-xs">
			{[
				["Casablanca · Maârif", "9 RDV aujourd’hui", true],
				["Rabat · Agdal", "5 RDV aujourd’hui", false],
			].map(([name, detail, current]) => (
				<p key={name as string} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", current && "ring-primary/40 ring-2")}>
					<IconLocation className="text-primary size-4" />
					<span className="flex-1">
						<span className="block font-medium">{name}</span>
						<span className="text-muted-foreground">{detail}</span>
					</span>
				</p>
			))}
		</div>
	);
}
