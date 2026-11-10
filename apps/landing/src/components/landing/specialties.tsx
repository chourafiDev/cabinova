import { IconStethoscope } from "@/components/icons";
import { SPECIALTIES } from "@/lib/site";

/** A slow band of specialties, under the hero. */
export function Specialties() {
	return (
		<section aria-label="Spécialités" className="py-12">
			<p className="text-muted-foreground mb-8 text-center text-sm">Pour toutes les spécialités</p>
			<div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
				<ul className="animate-scroll flex w-max gap-12 [--animation-duration:60s] hover:[animation-play-state:paused] motion-reduce:animate-none">
					{[...SPECIALTIES, ...SPECIALTIES].map((s, i) => (
						<li key={`${s}-${i}`} aria-hidden={i >= SPECIALTIES.length} className="flex items-center gap-2 text-lg font-medium whitespace-nowrap">
							<IconStethoscope className="text-primary size-5" /> {s}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
