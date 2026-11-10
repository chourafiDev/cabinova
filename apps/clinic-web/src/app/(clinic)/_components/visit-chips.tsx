"use client";

import { differenceInMinutes } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/components/current-user";
import { IconArrowRight, IconClock, IconStethoscope } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { dossierHref, fullName, isMedicalRole } from "@/lib/patients";
import { useNow } from "@/lib/use-now";
import { useWaitingActions } from "@/lib/use-waiting-actions";
import { useWaiting } from "../appointments/_components/use-today";

const PILL = "h-8 rounded-full border !shadow-none";

/**
 * Header chips, only while there is something to show: who waits (a click
 * opens the waiting room; a doctor calls their next patient in), and the
 * doctor's own consultation in progress (a click goes back to the dossier).
 */
export function VisitChips() {
	const user = useCurrentUser();
	const doctor = isMedicalRole(user.role);
	const { waiting, inConsultation } = useWaiting();
	const actions = useWaitingActions();
	const now = useNow();
	const t = useTranslations("nav.visitChips");

	// A doctor calls in their own patients, in arrival order.
	const next = doctor ? waiting.find((a) => a.practitioner.id === user.id) : undefined;
	const mine = doctor ? inConsultation.filter((a) => a.practitioner.id === user.id) : [];
	const current = mine[0];
	const minutes = current?.consultationStartedAt
		? Math.max(0, differenceInMinutes(now, new Date(current.consultationStartedAt)))
		: null;

	if (waiting.length === 0 && !current) return null;
	return (
		<div className="flex items-center gap-2">
			{current && (
				<Button
					asChild
					variant="outline"
					size="sm"
					className={`${PILL} max-w-56 hover:bg-orange-100 border border-orange-300 bg-orange-50 text-orange-500`}
				>
					<Link href={dossierHref(current.patient.id, current.id)} aria-label={t("resume", { patient: fullName(current.patient) })}>
						<span className="relative flex size-2 shrink-0">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75 motion-reduce:animate-none" />
							<span className="relative inline-flex size-2 rounded-full bg-orange-500" />
						</span>
						<IconStethoscope className="hidden xl:block" />
						<span className="truncate">{fullName(current.patient)}</span>
						{minutes !== null && <span className="hidden tabular-nums opacity-70 sm:inline">· {t("minutes", { count: minutes })}</span>}
						{mine.length > 1 && <span className="opacity-70">+{mine.length - 1}</span>}
					</Link>
				</Button>
			)}
			{waiting.length > 0 && (
				<div className="flex items-center">
					<Button
						asChild
						variant="outline"
						size="sm"
						className={`${PILL} hover:bg-orange-100 border border-orange-300 bg-orange-50 text-orange-500 ${next ? "rounded-e-none border-e-0" : ""}`}
					>
						<Link href="/appointments?tab=waiting" aria-label={t("waitingLabel", { count: waiting.length })}>
							<IconClock />
							<span className="tabular-nums">{waiting.length}</span>
							<span className="hidden lg:inline">{t("waiting")}</span>
						</Link>
					</Button>
					{next && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actions.busy === next.id}
							onClick={() => actions.openFile(next)}
							title={t("callNextTitle", { patient: fullName(next.patient) })}
							className={`${PILL} hover:bg-orange-100 rounded-s-none border border-orange-300 bg-orange-50 text-orange-500`}
						>
							<span className="hidden sm:inline">{t("callNext")}</span>
							<IconArrowRight className="rtl:rotate-180" />
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
