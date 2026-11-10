import { IconStar } from "@/components/icons";
import { TESTIMONIALS } from "@/lib/site";
import { Accent } from "./section-heading";

/** What doctors say (the quotes in site.ts are examples to replace before launch), in a row that scrolls sideways. */
export function Testimonials() {
	return (
		<section className="py-20 sm:py-28">
			<div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-[1.3fr_1fr] md:items-end">
				<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
					Ils ont simplifié <Accent>leur cabinet</Accent>
				</h2>
				<p className="text-muted-foreground text-base text-pretty sm:text-lg">
					Médecins et secrétaires racontent ce qui a changé au quotidien, de l’accueil à la clôture de caisse.
				</p>
			</div>
			<ul
				className="mx-auto mt-12 flex max-w-6xl snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:px-6"
				aria-label="Témoignages"
			>
				{TESTIMONIALS.map((t) => (
					<li key={t.name} className="bg-card flex w-[20rem] shrink-0 snap-start flex-col rounded-3xl border p-7 shadow-sm sm:w-[24rem]">
						<span className="flex gap-0.5 text-amber-500" aria-label="5 sur 5">
							{Array.from({ length: 5 }, (_, i) => (
								<IconStar key={i} className="size-5" />
							))}
						</span>
						<blockquote className="mt-6 flex-1 text-base leading-relaxed">« {t.quote} »</blockquote>
						<p className="mt-8 flex items-center gap-3 border-t pt-5">
							<span className="bg-accent text-primary flex size-10 items-center justify-center rounded-full text-sm font-semibold">
								{t.name.replace(/^Dr\s*/, "").charAt(0)}
							</span>
							<span>
								<span className="block font-medium">{t.name}</span>
								<span className="text-muted-foreground block text-xs">{t.title}</span>
							</span>
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}
