import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { TESTIMONIALS } from "@/lib/site";
import { SectionHeading } from "./section-heading";

/** What doctors say (the quotes in site.ts are examples to replace before launch). */
export function Testimonials() {
	return (
		<section className="overflow-hidden py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Témoignages"
					title="Ils ont simplifié leur cabinet"
					description="Médecins et secrétaires racontent ce qui a changé au quotidien."
				/>
			</div>
			<InfiniteMovingCards items={TESTIMONIALS} speed="slow" className="mx-auto mt-12" />
		</section>
	);
}
