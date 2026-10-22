"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	bmi,
	type ConsultationInput,
	consultationSchema,
	TEXT_SECTIONS,
	toConsultationBody,
	VITALS,
} from "@/lib/consultations";
import { FormCard } from "../../../_components/shared/form-card";
import { UnsavedChangesBar } from "../../../_components/shared/unsaved-changes-bar";

const FORM_ID = "consultation-form";

/** Motif, constantes and clinical sections. "Clôturer" saves first, then locks. */
export function ConsultationEditor({
	consultationId,
	defaultValues,
	readOnly,
}: {
	consultationId: string;
	defaultValues: ConsultationInput;
	readOnly: boolean;
}) {
	const router = useRouter();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [completing, setCompleting] = useState(false);
	const form = useForm<ConsultationInput>({
		resolver: zodResolver(consultationSchema),
		defaultValues,
		mode: "onTouched",
	});
	const { errors, isDirty, isSubmitting } = form.formState;
	const [weight, height] = useWatch({ control: form.control, name: ["weightKg", "heightCm"] });
	const imc = bmi(Number(weight.replace(",", ".")) || null, Number(height.replace(",", ".")) || null);

	const save = async (values: ConsultationInput) => {
		await api(`/consultations/${consultationId}`, {
			method: "PUT",
			body: JSON.stringify(toConsultationBody(values)),
		});
		form.reset(values);
	};

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await save(values);
			toast.success("Consultation enregistrée");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		}
	});

	const complete = form.handleSubmit(async (values) => {
		setCompleting(true);
		try {
			if (isDirty) await save(values);
			await api(`/consultations/${consultationId}/complete`, { method: "POST" });
			toast.success("Consultation clôturée");
			setConfirmOpen(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Clôture impossible");
		} finally {
			setCompleting(false);
		}
	});

	return (
		<form id={FORM_ID} onSubmit={onSubmit} noValidate className="grid gap-3">
			<fieldset disabled={readOnly} className="grid gap-3">
				<FormCard title="Motif">
					<Field data-invalid={!!errors.reason}>
						<Input
							id="reason"
							aria-label="Motif de consultation"
							placeholder="Motif de consultation"
							{...form.register("reason")}
						/>
						<FieldError errors={[errors.reason]} />
					</Field>
				</FormCard>

				<FormCard title="Constantes">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{VITALS.map((v) => (
							<Field key={v.name} data-invalid={!!errors[v.name]}>
								<FieldLabel htmlFor={v.name} className="text-xs">
									{v.label}
								</FieldLabel>
								<div className="relative">
									<Input
										id={v.name}
										inputMode="decimal"
										autoComplete="off"
										aria-invalid={!!errors[v.name]}
										className="pe-12 tabular-nums"
										{...form.register(v.name)}
									/>
									<span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs">
										{v.unit}
									</span>
								</div>
								<FieldError errors={[errors[v.name]]} />
							</Field>
						))}
					</div>
					<p className="text-muted-foreground mt-3 text-sm">
						IMC : <span className="text-foreground font-medium tabular-nums">{imc ?? "—"}</span>
						{imc !== null && " kg/m²"}
					</p>
				</FormCard>

				{TEXT_SECTIONS.map((s) => (
					<FormCard key={s.name} title={s.label}>
						<Field data-invalid={!!errors[s.name]}>
							<Textarea
								id={s.name}
								aria-label={s.label}
								rows={s.name === "diagnosis" ? 2 : 4}
								placeholder={s.placeholder}
								{...form.register(s.name)}
							/>
							<FieldError errors={[errors[s.name]]} />
						</Field>
					</FormCard>
				))}
			</fieldset>

			{!readOnly && (
				<div className="flex justify-end">
					<Button type="button" onClick={() => setConfirmOpen(true)}>
						<CheckCircle2 className="size-4" />
						Clôturer la consultation
					</Button>
				</div>
			)}

			<Dialog open={confirmOpen} onOpenChange={(open) => !completing && setConfirmOpen(open)}>
				<DialogContent className="sm:max-w-[460px]">
					<DialogHeader>
						<DialogTitle>Clôturer la consultation ?</DialogTitle>
						<DialogDescription>
							Elle sera enregistrée puis verrouillée : plus aucune modification ne sera possible. Le
							rendez-vous associé passe à « Terminé ».
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={completing}>
							Annuler
						</Button>
						<Button type="button" onClick={complete} disabled={completing}>
							{completing && <Loader className="size-4 animate-spin" />}
							Clôturer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<UnsavedChangesBar
				visible={isDirty && !readOnly}
				label="Modifications non enregistrées"
				isSubmitting={isSubmitting}
				onDiscard={() => form.reset()}
				formId={FORM_ID}
			/>
		</form>
	);
}
