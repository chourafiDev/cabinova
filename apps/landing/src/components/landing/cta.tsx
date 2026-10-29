import { LuArrowRight } from "react-icons/lu";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { CONTACT_EMAIL, demoHref, TRIAL_DAYS } from "@/lib/site";

/** The last push: try it, or talk to us. */
export function Cta() {
	return (
		<section className="pb-20 sm:pb-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="from-brand relative overflow-hidden rounded-[2rem] bg-gradient-to-br to-[#3d2550] px-6 py-16 text-center text-white sm:px-12">
					<div
						aria-hidden
						className="absolute inset-0 [background-image:linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
					/>
					<div className="relative">
						<h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
							Prêt à simplifier votre cabinet ?
						</h2>
						<p className="mx-auto mt-4 max-w-xl text-white/75">
							{TRIAL_DAYS} jours pour tout essayer avec votre équipe. Nous créons votre cabinet et vous accompagnons pour la prise en main.
						</p>
						<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
							<MovingBorderButton
								as="a"
								href={demoHref}
								borderRadius="9999px"
								containerClassName="h-12 w-64"
								borderClassName="bg-[radial-gradient(#e9dff0_40%,transparent_60%)]"
								className="text-brand gap-2 border-0 bg-white text-sm font-medium"
							>
								Demander une démo <LuArrowRight className="size-4" />
							</MovingBorderButton>
							<a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
								ou écrivez-nous à {CONTACT_EMAIL}
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
