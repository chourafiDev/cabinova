import { LuStethoscope } from "react-icons/lu";
import { SPECIALTIES } from "@/lib/site";

/** A slow band of specialties, under the hero. */
export function Specialties() {
	return (
		<section aria-label="Spécialités" className="border-y py-6">
			<p className="text-muted-foreground mb-4 text-center text-xs font-medium tracking-wider uppercase">
				Pour toutes les spécialités
			</p>
			<div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
				<ul className="animate-scroll flex w-max gap-3 [--animation-duration:60s] hover:[animation-play-state:paused] motion-reduce:animate-none">
					{[...SPECIALTIES, ...SPECIALTIES].map((s, i) => (
						<li
							key={`${s}-${i}`}
							aria-hidden={i >= SPECIALTIES.length}
							className="bg-card text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap"
						>
							<LuStethoscope className="text-primary size-3.5" /> {s}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
