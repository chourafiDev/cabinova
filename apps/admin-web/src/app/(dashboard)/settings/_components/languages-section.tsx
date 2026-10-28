"use client";

import { LuCheck } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import { type Language, LANGUAGE_LABELS, type PlatformSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Block, SectionForm, useSection } from "./section-form";

const ALL = Object.keys(LANGUAGE_LABELS) as Language[];

export function LanguagesSection({ initial, readOnly }: { initial: PlatformSettings["languages"]; readOnly: boolean }) {
	const s = useSection(initial, "languages");
	const v = s.value;

	return (
		<SectionForm
			title="Langues"
			description="La langue donnée aux nouveaux cabinets et celles qu’ils pourront choisir."
			dirty={s.dirty}
			saving={s.saving}
			onSubmit={() => s.save()}
			onDiscard={s.discard}
			readOnly={readOnly}
		>
			<Block title="Langue par défaut" caption="Appliquée à chaque cabinet créé ; les cabinets existants gardent la leur.">
				<div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
					{ALL.map((l) => (
						<button
							key={l}
							type="button"
							role="radio"
							aria-checked={v.defaultLanguage === l}
							onClick={() => s.set({ defaultLanguage: l, available: v.available.includes(l) ? v.available : [...v.available, l] })}
							className={cn(
								"flex items-center justify-between rounded-lg border p-3 text-start text-sm hover:bg-muted/50",
								v.defaultLanguage === l && "border-primary bg-primary/5 ring-1 ring-primary",
							)}
						>
							{LANGUAGE_LABELS[l]}
							{v.defaultLanguage === l && <LuCheck className="size-4 text-primary" />}
						</button>
					))}
				</div>
			</Block>
			<Block
				title="Langues proposées aux cabinets"
				caption="L’application des cabinets s’appuiera sur ce choix ; la langue par défaut est toujours proposée."
			>
				<div className="grid gap-2">
					{ALL.map((l) => (
						<label key={l} className="flex items-center gap-2 text-sm">
							<Checkbox
								checked={v.available.includes(l)}
								disabled={l === v.defaultLanguage}
								onCheckedChange={(c) =>
									s.set({ available: c === true ? [...v.available, l] : v.available.filter((x) => x !== l) })
								}
							/>
							{LANGUAGE_LABELS[l]}
							{l === v.defaultLanguage && <span className="text-xs text-muted-foreground">(par défaut)</span>}
						</label>
					))}
				</div>
			</Block>
		</SectionForm>
	);
}
