"use client";

import { LuArchive } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { FormCard } from "../../_components/shared/form-card";

/** How long a closed cabinet's data must be kept before it may be deleted. */
export function RetentionCard({ years, canEdit }: { years: number; canEdit: boolean }) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(String(years));

	const save = async () => {
		try {
			await api("/security/compliance", { method: "PUT", body: JSON.stringify({ retentionYears: Number(value) }) });
			toast.success("Durée de conservation enregistrée");
			setEditing(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		}
	};

	return (
		<FormCard title="Conservation des données">
			<div className="flex items-start gap-3 text-sm">
				<LuArchive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<div className="grid flex-1 gap-2">
					{editing ? (
						<div className="flex flex-wrap items-center gap-2">
							<Input
								inputMode="numeric"
								className="h-8 w-20"
								value={value}
								onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
								aria-label="Années de conservation"
							/>
							<span>ans après la fermeture</span>
							<Button size="sm" onClick={save} disabled={value === "" || Number(value) > 50}>
								Enregistrer
							</Button>
							<Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
								Annuler
							</Button>
						</div>
					) : (
						<p>
							Les données d’un cabinet fermé sont conservées <strong>{years} ans</strong> avant de pouvoir être supprimées.
							{canEdit && (
								<Button size="sm" variant="link" className="h-auto px-1" onClick={() => setEditing(true)}>
									Modifier
								</Button>
							)}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Valeur prudente par défaut : faites-la valider selon les obligations légales applicables aux dossiers
						médicaux. La suppression reste toujours manuelle, après un export.
					</p>
				</div>
			</div>
		</FormCard>
	);
}
