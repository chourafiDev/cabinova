"use client";

import { useState } from "react";
import { IconArrowRight, IconCheck, IconStar } from "@/components/icons";
import { demoHref, PLANS, TRIAL_DAYS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Accent } from "./section-heading";

const mad = (value: number) => new Intl.NumberFormat("fr-MA").format(value);

/** The three offers, monthly or yearly (two months free). */
export function Pricing() {
	const [annual, setAnnual] = useState(false);

	return (
		<section id="tarifs" className="relative overflow-hidden py-20 sm:py-28">
			<div aria-hidden className="bg-brand/10 pointer-events-none absolute top-40 left-1/2 -z-10 h-[28rem] w-[50rem] -translate-x-1/2 rounded-full blur-3xl" />
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="max-w-xl">
						<h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
							Des offres simples, <Accent>en dirhams</Accent>
						</h2>
						<p className="text-muted-foreground mt-4 text-base sm:text-lg">
							{TRIAL_DAYS} jours d’essai gratuit sur toutes les offres, sans engagement. Paiement par virement.
						</p>
					</div>
					<div className="bg-card flex w-fit rounded-full border p-1 text-sm shadow-sm" role="group" aria-label="Facturation">
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

				<ul className="mt-12 grid gap-5 lg:grid-cols-3">
					{PLANS.map((plan) => (
						<li
							key={plan.key}
							className={cn(
								"from-brand-soft to-card relative flex flex-col rounded-3xl border bg-gradient-to-b p-3 shadow-sm",
								plan.featured && "border-primary/50 ring-primary/10 ring-4",
							)}
						>
							<div className="p-5">
								<div className="flex items-center justify-between">
									<span className="bg-card text-primary flex size-10 items-center justify-center rounded-xl border">
										<IconStar className="size-5" />
									</span>
									{plan.featured && (
										<span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">Recommandé</span>
									)}
								</div>
								<h3 className="mt-6 text-2xl font-medium">{plan.name}</h3>
								<p className="text-muted-foreground mt-1 min-h-10 text-sm">{plan.description}</p>
								<p className="mt-5 flex items-baseline gap-1.5">
									<span className="text-4xl font-semibold tracking-tight">{mad(annual ? plan.annual : plan.monthly)}</span>
									<span className="text-muted-foreground text-sm">MAD / {annual ? "an" : "mois"}</span>
								</p>
								<p className="text-muted-foreground mt-1 h-5 text-xs">{annual && `soit ${mad(Math.round(plan.annual / 12))} MAD par mois`}</p>
							</div>
							<div className="bg-card flex flex-1 flex-col rounded-2xl border p-5">
								<p className="text-sm font-medium">Ce qui est inclus :</p>
								<ul className="mt-4 grid flex-1 content-start gap-3 text-sm">
									{plan.highlights.map((h) => (
										<li key={h} className={cn("flex items-start gap-2.5", h.endsWith(":") && "text-muted-foreground font-medium")}>
											{!h.endsWith(":") && (
												<span className="bg-accent text-primary mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
													<IconCheck className="size-3" />
												</span>
											)}
											{h}
										</li>
									))}
								</ul>
								<a
									href={demoHref}
									className={cn(
										"mt-7 flex h-11 items-center justify-center gap-1.5 rounded-full font-medium transition",
										plan.featured ? "btn-raised bg-primary text-primary-foreground" : "bg-card hover:bg-muted border",
									)}
								>
									Commencer l’essai <IconArrowRight className="size-4 rtl:rotate-180" />
								</a>
							</div>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
