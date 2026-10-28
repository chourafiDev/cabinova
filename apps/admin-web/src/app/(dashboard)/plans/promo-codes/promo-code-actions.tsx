"use client";

import { Loader, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { useOpenFromUrl } from "@/hooks/use-open-from-url";

const EMPTY = { code: "", description: "", discountPercent: "20", durationInvoices: "", validUntil: "", maxRedemptions: "" };

/** Create a code: percentage, how many invoices, end date, uses, plans. */
export function NewPromoCodeDialog({ plans }: { plans: { key: string; name: string }[] }) {
	const router = useRouter();
	const [open, setOpen] = useOpenFromUrl();
	const [v, setV] = useState(EMPTY);
	const [planKeys, setPlanKeys] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const set = (p: Partial<typeof EMPTY>) => setV((x) => ({ ...x, ...p }));
	const pct = Number(v.discountPercent);
	const n = Number(v.durationInvoices);

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			await api("/billing/promo-codes", {
				method: "POST",
				body: JSON.stringify({
					code: v.code,
					description: v.description || undefined,
					discountPercent: pct,
					durationInvoices: v.durationInvoices ? n : undefined,
					validUntil: v.validUntil || undefined,
					maxRedemptions: v.maxRedemptions ? Number(v.maxRedemptions) : undefined,
					planKeys,
				}),
			});
			toast.success(`Code ${v.code.toUpperCase()} créé`);
			setOpen(false);
			setV(EMPTY);
			setPlanKeys([]);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Création impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus /> Nouveau code
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Nouveau code promo</DialogTitle>
					<DialogDescription>Le pourcentage et la durée ne changent plus une fois le code créé.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="pc-code">Code</FieldLabel>
							<Input
								id="pc-code"
								className="font-mono uppercase"
								placeholder="LANCEMENT2026"
								value={v.code}
								onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="pc-pct">Remise (%)</FieldLabel>
							<Input
								id="pc-pct"
								inputMode="numeric"
								value={v.discountPercent}
								onChange={(e) => set({ discountPercent: e.target.value.replace(/\D/g, "") })}
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="pc-desc">Description</FieldLabel>
						<Input
							id="pc-desc"
							placeholder="Offre de lancement — salon médical de Casablanca"
							value={v.description}
							onChange={(e) => set({ description: e.target.value })}
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-3">
						<Field>
							<FieldLabel htmlFor="pc-dur">Durée</FieldLabel>
							<Input
								id="pc-dur"
								inputMode="numeric"
								placeholder="∞"
								value={v.durationInvoices}
								onChange={(e) => set({ durationInvoices: e.target.value.replace(/\D/g, "") })}
							/>
							<FieldDescription>factures (vide : toujours)</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="pc-max">Utilisations max</FieldLabel>
							<Input
								id="pc-max"
								inputMode="numeric"
								placeholder="∞"
								value={v.maxRedemptions}
								onChange={(e) => set({ maxRedemptions: e.target.value.replace(/\D/g, "") })}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="pc-until">Valable jusqu’au</FieldLabel>
							<Input id="pc-until" type="date" value={v.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
						</Field>
					</div>
					<Field>
						<FieldLabel>Offres concernées</FieldLabel>
						<div className="flex flex-wrap gap-4">
							{plans.map((p) => (
								<label key={p.key} className="flex items-center gap-2 text-sm">
									<Checkbox
										checked={planKeys.includes(p.key)}
										onCheckedChange={(c) =>
											setPlanKeys((k) => (c === true ? [...k, p.key] : k.filter((x) => x !== p.key)))
										}
									/>
									{p.name}
								</label>
							))}
						</div>
						<FieldDescription>Aucune cochée : toutes les offres.</FieldDescription>
					</Field>
					{v.code && pct > 0 && (
						<p className="rounded-md bg-muted px-3 py-2 text-sm">
							<span className="font-mono font-medium">{v.code}</span> : −{pct} %{" "}
							{v.durationInvoices ? `sur les ${n} prochaine${n > 1 ? "s" : ""} facture${n > 1 ? "s" : ""}` : "sur toutes les factures"}
							{planKeys.length ? `, offres ${plans.filter((p) => planKeys.includes(p.key)).map((p) => p.name).join(", ")}` : ""}.
						</p>
					)}
					<FieldError>{error}</FieldError>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Annuler
					</Button>
					<Button onClick={save} disabled={saving || v.code.length < 3 || !(pct >= 1 && pct <= 100)}>
						{saving && <Loader className="animate-spin" />} Créer le code
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Turn a code off (cabinets already using it keep it). */
export function PromoActiveSwitch({ id, code, active }: { id: string; code: string; active: boolean }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	return (
		<Switch
			checked={active}
			disabled={pending}
			aria-label={`Activer ${code}`}
			onCheckedChange={(next) =>
				startTransition(async () => {
					try {
						await api(`/billing/promo-codes/${id}`, { method: "PATCH", body: JSON.stringify({ active: next }) });
						toast.success(next ? `${code} réactivé` : `${code} désactivé — les cabinets qui l’utilisent le gardent`);
						router.refresh();
					} catch (err) {
						toast.error(err instanceof Error ? err.message : "Modification impossible");
					}
				})
			}
		/>
	);
}
