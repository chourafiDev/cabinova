import { type AppIcon, IconDevices, IconEyeOff, IconHistory, IconKey, IconLayers, IconServer } from "@/components/icons";
import { cn } from "@/lib/utils";
import { PhoneMockup } from "./phone-mockup";
import { Accent, SectionHeading } from "./section-heading";

type Point = { icon: AppIcon; title: string; description: string; side: "start" | "end"; row: "top" | "middle" | "bottom" };

const POINTS: Point[] = [
	{ side: "start", row: "top", icon: IconServer, title: "Une base par cabinet", description: "Vos patients ne partagent jamais une table avec ceux d’un autre cabinet." },
	{ side: "start", row: "middle", icon: IconKey, title: "Accès chiffrés", description: "Identifiants de base chiffrés (AES-256), mots de passe jamais en clair." },
	{ side: "start", row: "bottom", icon: IconEyeOff, title: "Secret médical", description: "Les antécédents ne sont visibles que par les médecins." },
	{ side: "end", row: "top", icon: IconLayers, title: "Sites cloisonnés", description: "Chaque espace ne voit que ses patients, rendez-vous et encaissements." },
	{ side: "end", row: "middle", icon: IconDevices, title: "Appareils sous contrôle", description: "Déconnectez à distance un appareil perdu." },
	{ side: "end", row: "bottom", icon: IconHistory, title: "Rien ne s’efface", description: "Paiements annulés avec un motif, dossiers archivés plutôt que supprimés." },
];

/*
 * Wide screens: a dashed circle (radius 18rem) around the phone, a dot on it
 * for each point at 140°, 180° and 220° (mirrored on the right), and the text
 * set outside the circle from that dot, so the line never crosses it.
 * cos 40° × 18 ≈ 13.8rem, sin 40° × 18 ≈ 11.6rem.
 */
const AT: Record<Point["row"], { x: string; y: string }> = {
	top: { x: "13.8rem", y: "-11.6rem" },
	middle: { x: "18rem", y: "0rem" },
	bottom: { x: "13.8rem", y: "11.6rem" },
};
const GAP = "1.5rem";

/** Why a cabinet can trust Cabinova: six points around the app. */
export function Security() {
	return (
		<section id="securite" className="overflow-hidden py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					title={
						<>
							Les données de vos patients, <Accent>bien protégées</Accent>
						</>
					}
					description="Cabinova a été pensé dès le départ pour le secret médical : isolation, chiffrement et droits d’accès par rôle."
				/>
				<div className="relative mt-16 xl:h-[44rem]">
					<span
						aria-hidden
						className="border-primary/30 absolute top-1/2 left-1/2 hidden size-[36rem] -translate-1/2 rounded-full border-2 border-dashed xl:block"
					/>
					{POINTS.map((p) => (
						<span
							key={p.title}
							aria-hidden
							className="bg-primary ring-background absolute hidden size-3 -translate-1/2 rounded-full ring-4 xl:block"
							style={{
								left: `calc(50% ${p.side === "start" ? "-" : "+"} ${AT[p.row].x})`,
								top: `calc(50% + ${AT[p.row].y})`,
							}}
						/>
					))}
					<PhoneMockup screen="dossier" className="xl:absolute xl:top-1/2 xl:left-1/2 xl:-translate-1/2" />
					<ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:mt-0 xl:block">
						{POINTS.map((p) => (
							<li
								key={p.title}
								className={cn(
									"flex flex-col gap-2 xl:absolute xl:w-60",
									p.side === "start" ? "xl:right-(--h) xl:items-end xl:text-end" : "xl:left-(--h)",
									p.row === "top" && "xl:bottom-(--v)",
									p.row === "bottom" && "xl:top-(--v)",
									p.row === "middle" && "xl:top-1/2 xl:-translate-y-1/2",
								)}
								style={
									{
										// From the dot, outwards: the box never reaches inside the circle.
										"--h": `calc(50% + ${AT[p.row].x} + ${GAP})`,
										"--v": `calc(50% + ${AT[p.row].y.replace("-", "")} - 0.5rem)`,
									} as React.CSSProperties
								}
							>
								<span className="bg-accent text-primary flex size-10 items-center justify-center rounded-xl">
									<p.icon className="size-5" />
								</span>
								<h3 className="text-lg font-medium">{p.title}</h3>
								<p className="text-muted-foreground text-sm leading-relaxed">{p.description}</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
