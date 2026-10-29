"use client";

import { useState } from "react";
import { LuArrowRight, LuCheck } from "react-icons/lu";
import { demoHref, PLANS, TRIAL_DAYS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const mad = (value: number) => new Intl.NumberFormat("fr-MA").format(value);

/** The three offers, monthly or yearly (two months free). */
export function Pricing() {
	const [annual, setAnnual] = useState(false);

	return (
		<section id="tarifs" className="bg-muted/50 border-y py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<SectionHeading
					eyebrow="Tarifs"
					title="Des offres simples, en dirhams"
					description={`${TRIAL_DAYS} jours d’essai gratuit sur toutes les offres, sans engagement.`}
				/>
				<div className="mt-8 flex justify-center">
					<div className="bg-card flex rounded-full border p-1 text-sm shadow-sm" role="group" aria-label="Facturation">
						{[
							{ value: false, label: "Mensuel" },
							{ value: true, label: "Annuel" },
						].map((o) => (
							<button
								key={o.label}
								type="button"
								aria-pressed={annual === o.value}
								onClick={() => setAnnual(o.value)}
								className={cn(
									"flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
									annual === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
								)}
							>
								{o.label}
								{o.value && (
									<span
										className={cn(
											"rounded-full px-1.5 py-0.5 text-[10px]",
											annual ? "bg-white/20" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
										)}
									>
										2 mois offerts
									</span>
								)}
							</button>
						))}
					</div>
				</div>

				<ul className="mt-10 grid gap-5 lg:grid-cols-3">
					{PLANS.map((plan) => (
						<li
							key={plan.key}
							className={cn(
								"bg-card relative flex flex-col rounded-3xl border p-7 shadow-sm",
								plan.featured && "border-primary ring-primary/15 shadow-primary/10 shadow-xl ring-4 lg:-translate-y-3",
							)}
						>
							{plan.featured && (
								<span className="bg-primary text-primary-foreground absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-medium">
									Recommandé
								</span>
							)}
							<h3 className="text-lg font-semibold">{plan.name}</h3>
							<p className="text-muted-foreground mt-1 min-h-10 text-sm">{plan.description}</p>
							<p className="mt-6 flex items-baseline gap-1.5">
								<span className="text-4xl font-semibold tracking-tight">{mad(annual ? plan.annual : plan.monthly)}</span>
								<span className="text-muted-foreground text-sm">MAD / {annual ? "an" : "mois"}</span>
							</p>
							<p className="text-muted-foreground mt-1 h-5 text-xs">
								{annual && `soit ${mad(Math.round(plan.annual / 12))} MAD par mois`}
							</p>
							<a
								href={demoHref}
								className={cn(
									"mt-6 flex h-11 items-center justify-center gap-1.5 rounded-full font-medium transition",
									plan.featured
										? "bg-primary text-primary-foreground hover:opacity-90"
										: "bg-card hover:bg-muted border",
								)}
							>
								Commencer l’essai <LuArrowRight className="size-4" />
							</a>
							<ul className="mt-7 grid gap-3 text-sm">
								{plan.highlights.map((h) => (
									<li key={h} className={cn("flex items-start gap-2.5", h.endsWith(":") && "text-muted-foreground font-medium")}>
										{!h.endsWith(":") && (
											<span className="bg-accent text-primary mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
												<LuCheck className="size-3" />
											</span>
										)}
										{h}
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
