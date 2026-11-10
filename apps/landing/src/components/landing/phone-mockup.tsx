import { IconBell, IconCalendarCheck, IconClipboard, IconEyeOff, IconHealth, IconUsers } from "@/components/icons";
import { cn } from "@/lib/utils";

const NEXT = [
	{ initials: "SA", name: "Salma A.", detail: "10:30 · Contrôle", status: "En salle", tone: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
	{ initials: "OB", name: "Omar B.", detail: "11:00 · Fièvre", status: "Confirmé", tone: "bg-accent text-primary" },
	{ initials: "HL", name: "Houda L.", detail: "11:30 · Bilan", status: "Prévu", tone: "bg-muted text-muted-foreground" },
	{ initials: "YT", name: "Youssef T.", detail: "12:00 · Certificat", status: "Prévu", tone: "bg-muted text-muted-foreground" },
];

/** The clinic app on a phone (decorative; names and figures are examples). */
export function PhoneMockup({ screen = "today", className }: { screen?: "today" | "dossier"; className?: string }) {
	return (
		<div
			aria-hidden
			className={cn(
				"bg-ink relative mx-auto w-[17.5rem] rounded-[2.75rem] p-2.5 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/10",
				className,
			)}
		>
			<div className="bg-background relative h-[33rem] overflow-hidden rounded-[2.25rem] px-4 pt-11 text-start text-xs">
				<span className="bg-ink absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full" />
				<span className="text-foreground absolute top-3 left-6 text-[10px] font-semibold">9:41</span>
				{screen === "today" ? <Today /> : <Dossier />}
			</div>
		</div>
	);
}

function Today() {
	return (
		<>
			<div className="flex items-center gap-2">
				<span className="bg-brand flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white">DB</span>
				<span className="flex-1 font-medium">Bonjour, Dr Benali</span>
				<span className="bg-muted flex size-7 items-center justify-center rounded-full">
					<IconBell className="size-3.5" />
				</span>
			</div>
			<div className="bg-brand-soft mt-4 rounded-2xl p-4">
				<p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
					<IconCalendarCheck className="text-primary size-3.5" /> Rendez-vous aujourd’hui
				</p>
				<p className="mt-1 text-center text-3xl font-semibold tracking-tight">18</p>
				<p className="text-muted-foreground text-center text-[10px]">dont 3 en salle d’attente</p>
				<div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-medium">
					<span className="bg-primary text-primary-foreground rounded-lg py-2 text-center">Nouveau RDV</span>
					<span className="bg-ink rounded-lg py-2 text-center text-white">Salle d’attente</span>
				</div>
			</div>
			<div className="mt-4 flex items-center justify-between">
				<p className="font-medium">Prochains patients</p>
				<span className="text-primary text-[10px]">Tout voir</span>
			</div>
			<ul className="mt-2 grid gap-2">
				{NEXT.map((p) => (
					<li key={p.name} className="bg-card flex items-center gap-2 rounded-xl border p-2">
						<span className="bg-accent text-primary flex size-7 items-center justify-center rounded-full text-[10px] font-semibold">{p.initials}</span>
						<span className="min-w-0 flex-1">
							<span className="block font-medium">{p.name}</span>
							<span className="text-muted-foreground block text-[10px]">{p.detail}</span>
						</span>
						<span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", p.tone)}>{p.status}</span>
					</li>
				))}
			</ul>
		</>
	);
}

function Dossier() {
	return (
		<>
			<div className="flex items-center gap-2">
				<span className="bg-accent text-primary flex size-9 items-center justify-center rounded-full text-[11px] font-semibold">AF</span>
				<span className="flex-1">
					<span className="block font-medium">Amina F.</span>
					<span className="text-muted-foreground block text-[10px]">34 ans · CNOPS</span>
				</span>
			</div>
			<p className="mt-3 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
				Allergie : pénicilline
			</p>
			<div className="bg-ink mt-4 rounded-2xl p-4 text-white">
				<p className="flex items-center gap-1.5 text-[11px] text-white/70">
					<IconEyeOff className="size-3.5" /> Antécédents
				</p>
				<p className="mt-1 font-medium">Réservés aux médecins</p>
				<p className="mt-1 text-[10px] text-white/60">La secrétaire voit le dossier administratif, jamais le dossier médical.</p>
			</div>
			<p className="mt-4 flex items-center gap-1.5 font-medium">
				<IconHealth className="text-primary size-3.5" /> Constantes
			</p>
			<div className="mt-2 grid grid-cols-3 gap-2 text-center">
				{[
					["TA", "12/8"],
					["Pouls", "72"],
					["Poids", "61 kg"],
				].map(([k, v]) => (
					<span key={k} className="bg-card rounded-xl border p-2">
						<span className="text-muted-foreground block text-[9px]">{k}</span>
						<span className="block font-semibold">{v}</span>
					</span>
				))}
			</div>
			<p className="mt-4 flex items-center gap-1.5 font-medium">
				<IconClipboard className="text-primary size-3.5" /> Dernières visites
			</p>
			<ul className="mt-2 grid gap-2">
				{["12 oct. · Contrôle tension", "3 juil. · Bilan annuel"].map((v) => (
					<li key={v} className="bg-card flex items-center gap-2 rounded-xl border p-2 text-[11px]">
						<IconUsers className="text-muted-foreground size-3.5" /> {v}
					</li>
				))}
			</ul>
		</>
	);
}
