import { IconArrowRight } from "@/components/icons";
import { CONTACT_EMAIL, demoHref, TRIAL_DAYS } from "@/lib/site";
import { PhoneMockup } from "./phone-mockup";
import { Accent } from "./section-heading";

/** The last push: text on one side, the app on a colour field on the other. */
export function Cta() {
	return (
		<section className="pb-20 sm:pb-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="bg-muted/60 grid overflow-hidden rounded-[2rem] border lg:grid-cols-2">
					<div className="flex flex-col justify-center p-8 sm:p-12">
						<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
							Prêt à simplifier <Accent>votre cabinet ?</Accent>
						</h2>
						<p className="text-muted-foreground mt-4 max-w-md text-base sm:text-lg">
							{TRIAL_DAYS} jours pour tout essayer avec votre équipe. Nous créons votre cabinet et vous accompagnons pour la prise en main.
						</p>
						<a
							href={demoHref}
							className="btn-raised bg-primary text-primary-foreground mt-8 inline-flex h-12 w-fit items-center gap-2 rounded-full px-6 font-medium"
						>
							Demander une démo <IconArrowRight className="size-4 rtl:rotate-180" />
						</a>
						<a href={`mailto:${CONTACT_EMAIL}`} className="text-muted-foreground hover:text-foreground mt-10 text-sm">
							ou écrivez-nous à <span className="text-primary font-medium">{CONTACT_EMAIL}</span>
						</a>
					</div>
					<div className="from-brand to-highlight relative h-[26rem] overflow-hidden bg-gradient-to-br via-[#3d2550] lg:h-auto lg:min-h-[32rem]">
						<div
							aria-hidden
							className="absolute inset-0 [background-image:linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:40px_40px]"
						/>
						<PhoneMockup className="absolute top-12 left-1/2 -translate-x-1/2" />
					</div>
				</div>
			</div>
		</section>
	);
}
