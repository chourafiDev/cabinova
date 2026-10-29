import { LuPlus } from "react-icons/lu";
import { CONTACT_EMAIL, FAQ } from "@/lib/site";
import { SectionHeading } from "./section-heading";

/** Common questions, as native disclosure widgets (keyboard and screen reader friendly). */
export function Faq() {
	return (
		<section id="faq" className="py-20 sm:py-28">
			<div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
				<SectionHeading
					align="start"
					eyebrow="FAQ"
					title="Vos questions, nos réponses"
					description={
						<>
							Une autre question ? Écrivez-nous à{" "}
							<a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">
								{CONTACT_EMAIL}
							</a>
							.
						</>
					}
				/>
				<div className="divide-y rounded-3xl border">
					{FAQ.map((item) => (
						<details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
								{item.q}
								<span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full transition-transform group-open:rotate-45">
									<LuPlus className="size-4" />
								</span>
							</summary>
							<p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}
