"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import { AlertTriangle, Loader } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { IEvent } from "@/calendar/interfaces";
import { type PickedPatient, PatientPicker } from "@/components/patient-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { APPOINTMENTS_KEY, DURATIONS } from "@/lib/appointments";

const schema = z.object({
	patient: z
		.object({ id: z.string(), firstName: z.string(), lastName: z.string(), fileNumber: z.number() })
		.nullable()
		.refine((p) => Boolean(p), "Choisissez un patient"),
	practitionerId: z.string().min(1, "Choisissez un praticien"),
	date: z.string().min(1, "Date requise"),
	time: z.string().regex(/^\d{2}:\d{2}$/, "Heure requise"),
	duration: z.number().int().positive(),
	reason: z.string().trim().max(200),
	notes: z.string().trim().max(2000),
});
type Values = z.infer<typeof schema>;

const durationLabel = (min: number) =>
	min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")}` : ""}`;

/**
 * Book (no `event`) or edit an appointment. Mounted by AppointmentDialogsProvider
 * on each opening, from a time slot (`startDate` / `startTime`), the header or
 * the details dialog.
 */
export function AppointmentFormDialog({
	event,
	startDate,
	startTime,
	patient,
	open,
	onOpenChange: setOpen,
}: {
	event?: IEvent;
	patient?: PickedPatient;
	startDate?: Date;
	startTime?: { hour: number; minute: number };
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { users, selectedDate, selectedUserId } = useCalendar();
	const queryClient = useQueryClient();

	const defaults = (): Values => {
		if (event) {
			const start = parseISO(event.startDate);
			return {
				patient: event.patient,
				practitionerId: event.user.id,
				date: format(start, "yyyy-MM-dd"),
				time: format(start, "HH:mm"),
				duration: differenceInMinutes(parseISO(event.endDate), start),
				reason: event.reason ?? "",
				notes: event.notes ?? "",
			};
		}
		const hour = startTime?.hour ?? 9;
		const minute = startTime?.minute ?? 0;
		return {
			patient: patient ?? null,
			practitionerId: selectedUserId !== "all" ? selectedUserId : (users[0]?.id ?? ""),
			date: format(startDate ?? selectedDate, "yyyy-MM-dd"),
			time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
			duration: 30,
			reason: "",
			notes: "",
		};
	};

	const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() });
	/** The practitioner is already booked then: the message, until the user decides. */
	const [overlap, setOverlap] = useState<string | null>(null);
	const { errors, isSubmitting } = form.formState;
	const durations = [...new Set([...DURATIONS, form.getValues("duration")])].sort((a, b) => a - b);

	const save = async (values: Values, allowOverlap: boolean) => {
		const startsAt = new Date(`${values.date}T${values.time}`);
		try {
			await api(event ? `/appointments/${event.id}` : "/appointments", {
				method: event ? "PUT" : "POST",
				body: JSON.stringify({
					patientId: values.patient!.id,
					practitionerId: values.practitionerId,
					startsAt: startsAt.toISOString(),
					endsAt: addMinutes(startsAt, values.duration).toISOString(),
					reason: values.reason,
					notes: values.notes,
					allowOverlap,
				}),
			});
			toast.success(event ? "Rendez-vous modifié" : "Rendez-vous ajouté");
			await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			setOpen(false);
		} catch (err) {
			if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
				setOverlap(err.message);
				return;
			}
			form.setError("root", { message: err instanceof Error ? err.message : "Enregistrement impossible" });
		}
	};
	const onSubmit = form.handleSubmit((values) => {
		setOverlap(null);
		return save(values, false);
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-[560px]">
				<form onSubmit={onSubmit} noValidate className="grid gap-4">
					<DialogHeader>
						<DialogTitle>{event ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
						<DialogDescription>
							{users.length
								? "Le créneau doit être libre pour le praticien choisi."
								: "Aucun praticien : attribuez le rôle « Médecin » à un membre de l'équipe."}
						</DialogDescription>
					</DialogHeader>

					<FieldGroup className="gap-4">
						<Controller
							control={form.control}
							name="patient"
							render={({ field }) => (
								<Field data-invalid={!!errors.patient}>
									<FieldLabel htmlFor="appointment-patient">Patient</FieldLabel>
									<PatientPicker
										id="appointment-patient"
										value={field.value}
										onChange={field.onChange}
										invalid={!!errors.patient}
									/>
									<FieldError errors={[errors.patient]} />
								</Field>
							)}
						/>

						<Controller
							control={form.control}
							name="practitionerId"
							render={({ field }) => (
								<Field data-invalid={!!errors.practitionerId}>
									<FieldLabel htmlFor="appointment-practitioner">Praticien</FieldLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="appointment-practitioner" className="w-full" aria-invalid={!!errors.practitionerId}>
											<SelectValue placeholder="Choisir…" />
										</SelectTrigger>
										<SelectContent>
											{users.map((u) => (
												<SelectItem key={u.id} value={u.id}>
													{u.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={[errors.practitionerId]} />
								</Field>
							)}
						/>

						<div className="grid gap-4 sm:grid-cols-3">
							<Field data-invalid={!!errors.date}>
								<FieldLabel htmlFor="appointment-date">Date</FieldLabel>
								<Input id="appointment-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
								<FieldError errors={[errors.date]} />
							</Field>
							<Field data-invalid={!!errors.time}>
								<FieldLabel htmlFor="appointment-time">Heure</FieldLabel>
								<Input id="appointment-time" type="time" step={300} aria-invalid={!!errors.time} {...form.register("time")} />
								<FieldError errors={[errors.time]} />
							</Field>
							<Controller
								control={form.control}
								name="duration"
								render={({ field }) => (
									<Field>
										<FieldLabel htmlFor="appointment-duration">Durée</FieldLabel>
										<Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
											<SelectTrigger id="appointment-duration" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{durations.map((d) => (
													<SelectItem key={d} value={String(d)}>
														{durationLabel(d)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							/>
						</div>

						<Field data-invalid={!!errors.reason}>
							<FieldLabel htmlFor="appointment-reason">Motif</FieldLabel>
							<Input
								id="appointment-reason"
								placeholder="Ex. Première consultation, contrôle, résultats…"
								aria-invalid={!!errors.reason}
								{...form.register("reason")}
							/>
							<FieldError errors={[errors.reason]} />
						</Field>

						<Field data-invalid={!!errors.notes}>
							<FieldLabel htmlFor="appointment-notes">Note pour l&apos;accueil</FieldLabel>
							<Textarea id="appointment-notes" rows={2} placeholder="Facultatif" {...form.register("notes")} />
						</Field>
					</FieldGroup>

					{errors.root && (
						<p role="alert" className="text-destructive text-sm">
							{errors.root.message}
						</p>
					)}
					{overlap && (
						<div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							<div className="grid gap-2">
								<p>{overlap} Réserver ce créneau quand même ?</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-fit bg-background"
									disabled={isSubmitting}
									onClick={form.handleSubmit((values) => save(values, true))}
								>
									Réserver quand même
								</Button>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting || !users.length}>
							{isSubmitting && <Loader className="size-4 animate-spin" />}
							{event ? "Enregistrer" : "Ajouter"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
