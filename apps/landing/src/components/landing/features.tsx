import type { IconType } from "react-icons";
import {
	LuCalendarDays,
	LuChartColumn,
	LuClipboardList,
	LuMapPin,
	LuReceipt,
	LuUsers,
} from "react-icons/lu";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

type Feature = {
	icon: IconType;
	title: string;
	description: string;
	points: string[];
	className: string;
	visual?: React.ReactNode;
};

const FEATURES: Feature[] = [
	{
		icon: LuCalendarDays,
		title: "Agenda et salle d’attente",
		description:
			"Prenez les rendez-vous en quelques clics, suivez l’arrivée des patients et faites-les entrer dans l’ordre.",
		points: ["Vue jour, semaine, mois", "Horaires d’ouverture par site", "Alerte de double réservation"],
		className: "md:col-span-2",
		visual: <AgendaVisual />,
	},
	{
		icon: LuClipboardList,
		title: "Dossiers patients",
		description: "Identité, couverture (CNSS, CNOPS, AMO…) et historique des visites, retrouvés par nom, téléphone ou CIN.",
		points: ["Antécédents réservés aux médecins", "Allergies mises en avant"],
		className: "",
	},
	{
		icon: LuReceipt,
		title: "Encaissements et reçus",
		description: "Tarifs du cabinet, paiements partiels, reçus numérotés avec le montant en lettres, clôture de caisse le soir.",
		points: ["Espèces, carte, chèque, virement", "Remboursements tracés"],
		className: "",
	},
	{
		icon: LuChartColumn,
		title: "Statistiques",
		description:
			"Consultations, nouveaux patients, absences, affluence par heure et chiffre d’affaires : votre activité en un coup d’œil.",
		points: ["Comparaison avec la période précédente", "Par médecin et par site"],
		className: "md:col-span-2",
		visual: <StatsVisual />,
	},
	{
		icon: LuUsers,
		title: "Équipe et rôles",
		description: "Invitez médecins et secrétaires par e-mail ; chacun voit ce dont il a besoin, rien de plus.",
		points: ["Invitation par lien sécurisé", "Accès coupé en un clic"],
		className: "",
	},
	{
		icon: LuMapPin,
		title: "Plusieurs sites",
		description: "Un cabinet à Casablanca, un autre à Rabat : chaque espace garde ses patients, son agenda et son équipe.",
		points: ["Données isolées par espace", "Vue d’ensemble pour le responsable"],
		className: "md:col-span-2",
		visual: <SitesVisual />,
	},
];

/** What the app does, as a bento grid with Aceternity's glowing borders. */
export function Features() {
	return (
		<section id="fonctionnalites" className="py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Fonctionnalités"
					title="Tout le cabinet, du rendez-vous au reçu"
					description="Une seule application pour l’accueil, la consultation et la gestion, pensée avec des médecins et des secrétaires."
				/>
				<ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
					{FEATURES.map((f) => (
						<li key={f.title} className={cn("min-h-[15rem] list-none", f.className)}>
							<div className="relative h-full rounded-3xl border p-2">
								<GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
								<div className="bg-card relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border p-6 shadow-sm">
									<div className={cn("flex h-full flex-col gap-5", f.visual && "lg:flex-row")}>
										<div className="flex flex-1 flex-col gap-3">
											<span className="bg-accent text-primary flex size-10 items-center justify-center rounded-xl">
												<f.icon className="size-5" />
											</span>
											<h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
											<p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
											<ul className="mt-auto grid gap-1.5 pt-2 text-sm">
												{f.points.map((p) => (
													<li key={p} className="flex items-center gap-2">
														<span className="bg-primary size-1.5 rounded-full" /> {p}
													</li>
												))}
											</ul>
										</div>
										{f.visual && <div className="lg:w-[46%]">{f.visual}</div>}
									</div>
								</div>
							</div>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

/** A day column of the agenda (decorative). */
function AgendaVisual() {
	const slots = [
		{ time: "09:00", name: "Amina F.", reason: "Contrôle tension", tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", status: "Vu" },
		{ time: "09:30", name: "Youssef B.", reason: "Fièvre et toux", tone: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200", status: "En salle" },
		{ time: "10:00", name: "Khadija E.", reason: "Bilan annuel", tone: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", status: "Confirmé" },
		{ time: "10:30", name: "Mehdi T.", reason: "Certificat médical", tone: "bg-muted text-foreground", status: "Planifié" },
	];
	return (
		<div aria-hidden className="bg-muted/60 grid h-full content-center gap-2 rounded-2xl p-3">
			{slots.map((s) => (
				<div key={s.time} className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2 text-xs shadow-sm">
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

/** Busy hours, as in the Statistiques page (decorative). */
function StatsVisual() {
	const rows = [
		[2, 5, 8, 6, 1, 0, 4, 7, 5],
		[3, 7, 9, 7, 2, 0, 5, 8, 4],
		[1, 4, 6, 5, 1, 0, 3, 6, 6],
		[2, 6, 7, 8, 2, 0, 4, 9, 7],
		[3, 5, 9, 6, 1, 0, 5, 7, 5],
	];
	return (
		<div aria-hidden className="bg-muted/60 flex h-full flex-col justify-center gap-1.5 rounded-2xl p-4">
			{rows.map((row, r) => (
				<div key={r} className="flex items-center gap-1.5">
					<span className="text-muted-foreground w-7 text-[10px]">{["Lun", "Mar", "Mer", "Jeu", "Ven"][r]}</span>
					{row.map((v, c) => (
						<span
							key={c}
							className="h-5 flex-1 rounded-[4px]"
							style={{ background: v === 0 ? "var(--card)" : `color-mix(in oklab, var(--brand) ${15 + v * 9}%, var(--card))` }}
						/>
					))}
				</div>
			))}
			<p className="text-muted-foreground mt-2 text-[10px]">Affluence par jour et par heure</p>
		</div>
	);
}

/** The space switcher with two sites (decorative). */
function SitesVisual() {
	const sites = [
		{ name: "Casablanca · Maârif", detail: "412 patients · 9 RDV aujourd’hui", current: true },
		{ name: "Rabat · Agdal", detail: "186 patients · 5 RDV aujourd’hui", current: false },
	];
	return (
		<div aria-hidden className="bg-muted/60 grid h-full content-center gap-2 rounded-2xl p-3">
			{sites.map((s) => (
				<div
					key={s.name}
					className={cn("bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs shadow-sm", s.current && "ring-primary/40 ring-2")}
				>
					<span className="bg-accent text-primary flex size-8 items-center justify-center rounded-lg">
						<LuMapPin className="size-4" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium">{s.name}</span>
						<span className="text-muted-foreground block truncate">{s.detail}</span>
					</span>
					{s.current && <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">Actuel</span>}
				</div>
			))}
		</div>
	);
}
