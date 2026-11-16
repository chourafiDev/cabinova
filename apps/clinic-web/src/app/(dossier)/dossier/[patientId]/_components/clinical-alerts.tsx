"use client";

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { type AppIcon, IconInfo, IconNote, IconPill } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fold } from "@/lib/format";
import type { PatientFile } from "@/lib/patients";
import { htmlToText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Tone = "treatment" | "note";

const TONES: Record<Tone, { icon: AppIcon; className: string }> = {
	treatment: {
		icon: IconPill,
		className: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
	},
	note: { icon: IconNote, className: "border-primary/30 bg-primary/10 text-primary" },
};

/**
 * Treatments a doctor must not miss before prescribing, found in the
 * patient's current treatments by name or class (accents and case aside).
 */
const SENSITIVE: { key: string; words: string[] }[] = [
	{
		key: "anticoagulant",
		words: ["anticoagul", "avk", "sintrom", "acenocoumarol", "warfarin", "coumadine", "previscan", "fluindione", "apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "heparine", "lovenox", "enoxaparine"],
	},
	{ key: "antiplatelet", words: ["aspirine", "kardegic", "clopidogrel", "plavix", "ticagrelor", "brilique"] },
	{ key: "insulin", words: ["insuline", "lantus", "novorapid", "humalog", "levemir", "toujeo", "tresiba"] },
	{ key: "corticoid", words: ["cortico", "prednisone", "prednisolone", "cortancyl", "solupred", "methylprednisolone", "medrol", "dexamethasone"] },
	{ key: "immunosuppressant", words: ["methotrexate", "immunosuppress", "ciclosporine", "azathioprine", "tacrolimus"] },
];

type Alert = { key: string; tone: Tone; label: string; detail: string };

/** At most this many chips; the rest behind "+n". */
const SHOWN = 6;

/**
 * What the doctor must never miss, readable from every tab: sensitive
 * treatments and the permanent note, from the patient's medical profile.
 * The note's chip opens the tab where it is edited; ⓘ says what the chips are.
 */
export function ClinicalAlerts({ patient }: { patient: PatientFile }) {
	const t = useTranslations("dossier.alerts");
	const [, openFile] = useQueryState("patient", parseAsString.withOptions({ history: "push", scroll: false }));
	const [, openTab] = useQueryState("onglet", parseAsString.withOptions({ history: "replace", scroll: false }));
	const open = (a: Alert) => void (a.tone === "note" ? openTab("interrogatoire") : openFile(patient.id));
	const profile = patient.medicalProfile;
	const treatments = fold(profile?.currentTreatments ?? "");
	// The note is rich text: the chip and its tooltip read it as plain text.
	const note = profile?.permanentNote ? htmlToText(profile.permanentNote) : "";

	const alerts: Alert[] = [
		...SENSITIVE.filter((s) => s.words.some((w) => treatments.includes(w))).map((s) => ({
			key: `treatment-${s.key}`,
			tone: "treatment" as const,
			label: t(`treatments.${s.key}`),
			detail: profile?.currentTreatments ?? "",
		})),
		...(note ? [{ key: "note", tone: "note" as const, label: note.replace(/\s*\n+\s*/g, " · "), detail: note }] : []),
	];

	if (!alerts.length) {
		return (
			<div className="flex items-center gap-1.5">
				<span className="text-muted-foreground text-xs">{t("none")}</span>
				<AlertsInfo />
			</div>
		);
	}

	const shown = alerts.slice(0, SHOWN);
	const rest = alerts.slice(SHOWN);

	return (
		<ul className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={t("label")}>
			{shown.map((a) => (
				<li key={a.key} className="min-w-0">
					<Chip alert={a} onClick={() => open(a)} />
				</li>
			))}
			{rest.length > 0 && (
				<li>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => void openFile(patient.id)}
								className="bg-muted text-muted-foreground hover:text-foreground rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums"
							>
								+{rest.length}
							</button>
						</TooltipTrigger>
						<TooltipContent className="max-w-72">
							<ul className="grid gap-0.5">
								{rest.map((a) => (
									<li key={a.key}>{a.detail}</li>
								))}
							</ul>
						</TooltipContent>
					</Tooltip>
				</li>
			)}
			<li>
				<AlertsInfo />
			</li>
		</ul>
	);
}

/** ⓘ: what the chips under the name are, where they come from, how far to trust them. */
function AlertsInfo() {
	const t = useTranslations("dossier.alerts.info");
	const kinds: { tone: Tone; title: string; text: string }[] = [
		{ tone: "treatment", title: t("treatmentTitle"), text: t("treatmentText") },
		{ tone: "note", title: t("noteTitle"), text: t("noteText") },
	];
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={t("open")}
					title={t("open")}
					className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center rounded-full"
				>
					<IconInfo className="size-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="grid w-80 gap-3 p-4 text-sm">
				<div className="grid gap-1">
					<p className="font-semibold">{t("title")}</p>
					<p className="text-muted-foreground text-xs">{t("intro")}</p>
				</div>
				<ul className="grid gap-3">
					{kinds.map(({ tone, title, text }) => {
						const { icon: Icon, className } = TONES[tone];
						return (
							<li key={tone} className="grid gap-1">
								<span className={cn("flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", className)}>
									<Icon className="size-3.5" /> {title}
								</span>
								<p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
							</li>
						);
					})}
				</ul>
				<p className="text-muted-foreground border-t pt-2 text-xs">{t("hover")}</p>
			</PopoverContent>
		</Popover>
	);
}

function Chip({ alert, onClick }: { alert: Alert; onClick: () => void }) {
	const { icon: Icon, className } = TONES[alert.tone];
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className={cn(
						"flex max-w-56 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
						className,
					)}
				>
					<Icon className="size-3.5 shrink-0" />
					<span className="truncate" dir="auto">
						{alert.label}
					</span>
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-72 whitespace-pre-line">{alert.detail}</TooltipContent>
		</Tooltip>
	);
}
