"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type PlatformSettings, TIMEZONES } from "@/lib/settings";
import { Block, SectionForm, useSection } from "./section-form";

type General = PlatformSettings["general"];

export function GeneralSection({ initial, readOnly }: { initial: General; readOnly: boolean }) {
	const s = useSection(
		{
			platformName: initial.platformName,
			supportEmail: initial.supportEmail ?? "",
			supportPhone: initial.supportPhone ?? "",
			websiteUrl: initial.websiteUrl ?? "",
			defaultTimezone: initial.defaultTimezone,
		},
		"general",
	);
	const v = s.value;

	return (
		<SectionForm
			title="Paramètres généraux"
			description="Le nom de la plateforme et la façon dont les cabinets vous joignent."
			dirty={s.dirty}
			saving={s.saving}
			onSubmit={() => s.save()}
			onDiscard={s.discard}
			readOnly={readOnly}
		>
			<Block>
				<Field>
					<FieldLabel htmlFor="platformName">Nom de la plateforme</FieldLabel>
					<Input id="platformName" value={v.platformName} onChange={(e) => s.set({ platformName: e.target.value })} />
					<FieldDescription>Affiché à la connexion, dans le menu, sur les factures et dans chaque e-mail.</FieldDescription>
				</Field>
			</Block>
			<Block
				title="Contact du support"
				caption="Ajoutés en pied de chaque e-mail envoyé aux cabinets. Laissez vide pour ne pas les afficher."
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="supportEmail">E-mail</FieldLabel>
						<Input
							id="supportEmail"
							type="email"
							placeholder="support@cabinova.ma"
							value={v.supportEmail}
							onChange={(e) => s.set({ supportEmail: e.target.value })}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="supportPhone">Téléphone</FieldLabel>
						<Input
							id="supportPhone"
							inputMode="tel"
							placeholder="+212 5 22 00 00 00"
							value={v.supportPhone}
							onChange={(e) => s.set({ supportPhone: e.target.value })}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="websiteUrl">Site web</FieldLabel>
					<Input
						id="websiteUrl"
						type="url"
						placeholder="https://cabinova.ma"
						value={v.websiteUrl}
						onChange={(e) => s.set({ websiteUrl: e.target.value })}
					/>
				</Field>
			</Block>
			<Block title="Valeurs par défaut des nouveaux cabinets" caption="Les cabinets existants gardent leur réglage.">
				<Field className="sm:w-1/2">
					<FieldLabel>Fuseau horaire</FieldLabel>
					<Select value={v.defaultTimezone} onValueChange={(tz) => s.set({ defaultTimezone: tz })} disabled={readOnly}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TIMEZONES.map((tz) => (
								<SelectItem key={tz.value} value={tz.value}>
									{tz.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</Block>
		</SectionForm>
	);
}
