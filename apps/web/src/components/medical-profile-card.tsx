"use client";

import { AlertTriangle, Loader, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormCard } from "@/app/(dashboard)/_components/shared/form-card";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { BLOOD_GROUPS, type MedicalProfile, PROFILE_FIELDS } from "@/lib/consultations";
import { cn } from "@/lib/utils";

type ProfileInput = Record<(typeof PROFILE_FIELDS)[number]["name"], string> & { bloodGroup: string };

const NONE = "none";

/** Antécédents of a patient (shown on the patient file and on every consultation). */
export function MedicalProfileCard({
	patientId,
	profile,
	canWrite,
}: {
	patientId: string;
	profile: MedicalProfile;
	canWrite: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const filled = PROFILE_FIELDS.filter((f) => profile[f.name]);

	return (
		<FormCard
			title="Antécédents"
			action={
				canWrite && (
					<Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
						<Pencil className="size-3.5" />
						Modifier
					</Button>
				)
			}
		>
			<dl className="grid gap-3 text-sm">
				<div>
					<dt className="text-muted-foreground text-xs">Groupe sanguin</dt>
					<dd className="font-medium">{profile.bloodGroup ?? "Non renseigné"}</dd>
				</div>
				{filled.map((f) => (
					<div
						key={f.name}
						className={cn(f.name === "allergies" && "rounded-md bg-red-50 p-2 text-red-800")}
					>
						<dt className={cn("flex items-center gap-1 text-xs", f.name === "allergies" ? "font-semibold" : "text-muted-foreground")}>
							{f.name === "allergies" && <AlertTriangle className="size-3.5" />}
							{f.label}
						</dt>
						<dd className="whitespace-pre-line">{profile[f.name]}</dd>
					</div>
				))}
				{!filled.length && <p className="text-muted-foreground">Aucun antécédent renseigné.</p>}
			</dl>
			{editing && (
				<EditProfileDialog patientId={patientId} profile={profile} onClose={() => setEditing(false)} />
			)}
		</FormCard>
	);
}

function EditProfileDialog({
	patientId,
	profile,
	onClose,
}: {
	patientId: string;
	profile: MedicalProfile;
	onClose: () => void;
}) {
	const router = useRouter();
	const form = useForm<ProfileInput>({
		defaultValues: {
			bloodGroup: profile.bloodGroup ?? NONE,
			...(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.name, profile[f.name] ?? ""])) as Record<
				(typeof PROFILE_FIELDS)[number]["name"],
				string
			>),
		},
	});
	const { isSubmitting } = form.formState;

	const onSubmit = form.handleSubmit(async ({ bloodGroup, ...rest }) => {
		try {
			await api(`/patients/${patientId}/medical-profile`, {
				method: "PUT",
				body: JSON.stringify({ ...rest, bloodGroup: bloodGroup === NONE ? null : bloodGroup }),
			});
			toast.success("Antécédents enregistrés");
			onClose();
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		}
	});

	return (
		<Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
			<DialogContent className="sm:max-w-[620px]">
				<form onSubmit={onSubmit} className="grid gap-4">
					<DialogHeader>
						<DialogTitle>Antécédents</DialogTitle>
						<DialogDescription>Visibles sur chaque consultation de ce patient.</DialogDescription>
					</DialogHeader>
					<FieldGroup className="max-h-[60vh] gap-4 overflow-y-auto px-0.5">
						<Controller
							control={form.control}
							name="bloodGroup"
							render={({ field }) => (
								<Field>
									<FieldLabel htmlFor="bloodGroup">Groupe sanguin</FieldLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="bloodGroup" className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>Non renseigné</SelectItem>
											{BLOOD_GROUPS.map((g) => (
												<SelectItem key={g} value={g}>
													{g}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						/>
						{PROFILE_FIELDS.map((f) => (
							<Field key={f.name}>
								<FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
								<Textarea id={f.name} rows={2} placeholder="Aucun" {...form.register(f.name)} />
							</Field>
						))}
					</FieldGroup>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader className="size-4 animate-spin" />}
							Enregistrer
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
