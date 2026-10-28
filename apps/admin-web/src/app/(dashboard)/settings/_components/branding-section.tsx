"use client";

import { LuImageUp, LuTriangleAlert, LuX } from "react-icons/lu";
import { useRef } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PlatformSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Block, SectionForm, useSection } from "./section-form";

const PRESETS = ["#613f75", "#2f5bd3", "#0f766e", "#b4234a", "#c2410c", "#1f2937"];
const MAX_BYTES = 200 * 1024;

/** WCAG contrast of white text on a colour (buttons and the initial use white). */
function contrastWithWhite(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Logo: unchanged, replaced (data URL), or removed. */
type Logo = { kind: "keep" } | { kind: "new"; dataUrl: string } | { kind: "remove" };

export function BrandingSection({
	initial,
	platformName,
	readOnly,
}: {
	initial: PlatformSettings["branding"];
	platformName: string;
	readOnly: boolean;
}) {
	const s = useSection({ primaryColor: initial.primaryColor, logo: { kind: "keep" } as Logo }, "branding");
	const file = useRef<HTMLInputElement>(null);
	const v = s.value;
	const validHex = /^#[0-9a-fA-F]{6}$/.test(v.primaryColor);
	const ratio = validHex ? contrastWithWhite(v.primaryColor) : 21;
	const preview = {
		platformName,
		primaryColor: validHex ? v.primaryColor : initial.primaryColor,
		logoUrl: v.logo.kind === "remove" ? null : v.logo.kind === "new" ? null : initial.logoUrl,
	};
	const logoSrc = v.logo.kind === "new" ? v.logo.dataUrl : null;

	const pick = (f: File | undefined) => {
		if (!f) return;
		if (!["image/png", "image/jpeg"].includes(f.type)) return toast.error("Choisissez une image PNG ou JPEG.");
		if (f.size > MAX_BYTES) return toast.error("Image trop lourde : 200 Ko maximum.");
		const reader = new FileReader();
		reader.onload = () => s.set({ logo: { kind: "new", dataUrl: String(reader.result) } });
		reader.readAsDataURL(f);
	};

	const mark = (className?: string) =>
		logoSrc ? (
			// eslint-disable-next-line @next/next/no-img-element
			<img src={logoSrc} alt="" className={cn("size-8 shrink-0 rounded-lg object-contain", className)} />
		) : (
			<BrandMark branding={preview} className={className} />
		);

	return (
		<SectionForm
			title="Identité visuelle"
			description="Votre logo et votre couleur, sur la page de connexion, le menu, les factures et les e-mails."
			dirty={s.dirty}
			saving={s.saving}
			onSubmit={() => {
				if (!validHex) return toast.error("Couleur au format #RRGGBB.");
				void s.save({
					primaryColor: v.primaryColor,
					...(v.logo.kind === "new" && { logo: v.logo.dataUrl }),
					...(v.logo.kind === "remove" && { logo: null }),
				});
			}}
			onDiscard={s.discard}
			readOnly={readOnly}
		>
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
				<div className="grid gap-4">
					<Block title="Logo" caption="PNG ou JPEG carré, 200 Ko maximum. Un fond plein s’affiche mieux dans les e-mails.">
						<div className="flex flex-wrap items-center gap-4">
							{mark("size-16 text-2xl")}
							<input
								ref={file}
								type="file"
								accept="image/png,image/jpeg"
								className="hidden"
								onChange={(e) => {
									pick(e.target.files?.[0]);
									e.target.value = "";
								}}
							/>
							<div className="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}>
									<LuImageUp /> {initial.logoUrl || v.logo.kind === "new" ? "Changer le logo" : "Ajouter un logo"}
								</Button>
								{(v.logo.kind === "new" || (initial.logoUrl && v.logo.kind === "keep")) && (
									<Button type="button" variant="ghost" size="sm" onClick={() => s.set({ logo: { kind: "remove" } })}>
										<LuX /> Retirer
									</Button>
								)}
							</div>
						</div>
						{!initial.logoUrl && v.logo.kind !== "new" && (
							<FieldDescription>Sans logo, l’initiale du nom s’affiche sur votre couleur.</FieldDescription>
						)}
					</Block>
					<Block title="Couleur principale">
						<div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Couleurs proposées">
							{PRESETS.map((c) => (
								<button
									key={c}
									type="button"
									role="radio"
									aria-checked={v.primaryColor.toLowerCase() === c}
									aria-label={c}
									onClick={() => s.set({ primaryColor: c })}
									className={cn(
										"size-8 rounded-full ring-offset-2 ring-offset-background transition-shadow",
										v.primaryColor.toLowerCase() === c && "ring-2 ring-foreground",
									)}
									style={{ backgroundColor: c }}
								/>
							))}
						</div>
						<Field className="sm:w-1/2">
							<FieldLabel htmlFor="primaryColor">Code couleur</FieldLabel>
							<div className="flex gap-2">
								<input
									type="color"
									aria-label="Choisir une couleur"
									value={validHex ? v.primaryColor : "#000000"}
									onChange={(e) => s.set({ primaryColor: e.target.value })}
									className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
								/>
								<Input
									id="primaryColor"
									value={v.primaryColor}
									onChange={(e) => s.set({ primaryColor: e.target.value.trim() })}
									className="font-mono"
									aria-invalid={!validHex}
								/>
							</div>
						</Field>
						{ratio < 4.5 && (
							<p className="flex items-center gap-1.5 text-xs text-amber-800">
								<LuTriangleAlert className="size-3.5" /> Trop claire : le texte blanc des boutons sera difficile à lire
								(contraste {ratio.toFixed(1)}:1, 4,5:1 recommandé).
							</p>
						)}
					</Block>
				</div>

				<aside className="grid items-start gap-3 sm:grid-cols-2 xl:sticky xl:top-4 xl:grid-cols-1">
					<div className="grid gap-2 rounded-xl border bg-card p-4">
						<span className="text-xs text-muted-foreground">Aperçu — menu</span>
						<div className="flex items-center gap-2 rounded-lg bg-sidebar p-2">
							{mark()}
							<span className="truncate text-sm font-semibold">{platformName}</span>
						</div>
					</div>
					<div className="grid gap-2 rounded-xl border bg-card p-4">
						<span className="text-xs text-muted-foreground">Aperçu — e-mail</span>
						<div className="paper overflow-hidden rounded-lg border bg-white text-zinc-900" style={{ borderTop: `4px solid ${preview.primaryColor}` }}>
							<div className="flex items-center gap-2 px-4 pt-4">
								{mark()}
								<span className="text-sm font-bold">{platformName}</span>
							</div>
							<div className="grid gap-3 px-4 py-4 text-xs">
								<p>Bonjour Dr. Bennani,</p>
								<p>Votre facture F-2026-000123 est disponible.</p>
								<span
									className="w-fit rounded-md px-3 py-1.5 font-semibold text-white"
									style={{ backgroundColor: preview.primaryColor }}
								>
									Voir la facture
								</span>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</SectionForm>
	);
}
