"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuArrowRight, LuCheck, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { NEW_PATIENT_HREF } from "@/lib/patients";
import { cn } from "@/lib/utils";

/** GET /onboarding/checklist: each step, from what the cabinet really did. */
export type ChecklistSteps = {
	hours: boolean;
	acts: boolean;
	team: boolean;
	patient: boolean;
	appointment: boolean;
};

const STEPS: { key: keyof ChecklistSteps; title: string; hint: string; href: string; action: string }[] = [
	{
		key: "hours",
		title: "Vérifiez vos horaires",
		hint: "L’agenda n’accepte de rendez-vous que pendant ces horaires.",
		href: "/settings/hours",
		action: "Vérifier",
	},
	{
		key: "acts",
		title: "Ajoutez vos tarifs",
		hint: "Consultation, contrôle, ECG… pour encaisser en un clic.",
		href: "/settings/tarifs",
		action: "Ajouter",
	},
	{
		key: "team",
		title: "Invitez votre équipe",
		hint: "Votre secrétaire ou un confrère reçoit un lien par e-mail.",
		href: "/staff",
		action: "Inviter",
	},
	{
		key: "patient",
		title: "Créez un premier patient",
		hint: "Son dossier, sa couverture et ses antécédents au même endroit.",
		href: NEW_PATIENT_HREF,
		action: "Créer",
	},
	{
		key: "appointment",
		title: "Prenez un premier rendez-vous",
		hint: "Il apparaît dans l’agenda et dans la salle d’attente.",
		href: "/appointments?view=day",
		action: "Ouvrir l’agenda",
	},
];

/** First steps of a new cabinet, on the dashboard until they're done or hidden. */
export function GettingStarted({ steps }: { steps: ChecklistSteps }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const done = STEPS.filter((s) => steps[s.key]).length;
	if (done === STEPS.length) return null;
	const next = STEPS.find((s) => !steps[s.key]);

	const post = async (path: string) => {
		setSaving(true);
		try {
			await api(`/onboarding/checklist/${path}`, { method: "POST" });
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<section aria-labelledby="getting-started" className="bg-card mb-4 rounded-xl border p-5">
			<header className="flex items-start justify-between gap-3">
				<div className="grid gap-0.5">
					<h2 id="getting-started" className="font-semibold">
						Bien démarrer avec Cabinova
					</h2>
					<p className="text-muted-foreground text-sm">
						{done} sur {STEPS.length} étapes terminées
					</p>
				</div>
				<Button
					size="icon"
					variant="ghost"
					className="size-8 shrink-0"
					aria-label="Masquer cette liste"
					title="Masquer cette liste"
					disabled={saving}
					onClick={() => post("dismiss")}
				>
					<LuX />
				</Button>
			</header>

			<div
				role="progressbar"
				aria-label="Progression"
				aria-valuemin={0}
				aria-valuemax={STEPS.length}
				aria-valuenow={done}
				className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
			>
				<div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
			</div>

			<ol className="mt-2 divide-y">
				{STEPS.map((step) => {
					const isDone = steps[step.key];
					const isNext = step === next;
					return (
						<li key={step.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 last:pb-0">
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded-full border",
									isDone && "bg-primary border-primary text-primary-foreground",
									isNext && "border-primary",
								)}
							>
								{isDone && <LuCheck className="size-3" />}
								<span className="sr-only">{isDone ? "Terminé" : "À faire"}</span>
							</span>
							<div className="min-w-0 flex-1 basis-52">
								<p className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}>{step.title}</p>
								{!isDone && <p className="text-muted-foreground text-xs">{step.hint}</p>}
							</div>
							{!isDone && (
								<div className="flex items-center gap-1">
									{step.key === "hours" && (
										<Button size="sm" variant="ghost" disabled={saving} onClick={() => post("hours")}>
											C’est bon
										</Button>
									)}
									<Button asChild size="sm" variant={isNext ? "default" : "outline"}>
										<Link href={step.href}>
											{step.action} {isNext && <LuArrowRight />}
										</Link>
									</Button>
								</div>
							)}
						</li>
					);
				})}
			</ol>
		</section>
	);
}
