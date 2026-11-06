"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMinutes, differenceInMinutes, format as formatDay, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { holidayOf, isWithinWorkingHours } from "@/calendar/helpers";
import { useFmt } from "@/calendar/locale";
import type { IEvent } from "@/calendar/interfaces";
import { IconClock, IconSpinner, IconWarning } from "@/components/icons";
import { NoShowNote } from "@/components/no-show-badge";
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
import { ActPicker } from "@/components/act-picker";
import type { Act } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";

const schemaOf = (
	t: (key: "choosePatient" | "choosePractitioner" | "dateRequired" | "timeRequired" | "chooseReason") => string,
	/** Booking needs an act; an older appointment without one can still be edited. */
	reasonRequired: boolean,
) =>
	z.object({
		patient: z
			.object({ id: z.string(), firstName: z.string(), lastName: z.string(), fileNumber: z.number() })
			.nullable()
			.refine((p) => Boolean(p), t("choosePatient")),
		practitionerId: z.string().min(1, t("choosePractitioner")),
		date: z.string().min(1, t("dateRequired")),
		time: z.string().regex(/^\d{2}:\d{2}$/, t("timeRequired")),
		duration: z.number().int().positive(),
		reason: z
			.string()
			.trim()
			.max(200)
			.refine((v) => !reasonRequired || v.length > 0, t("chooseReason")),
		notes: z.string().trim().max(2000),
	});
type Values = z.infer<ReturnType<typeof schemaOf>>;

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
	const { users, selectedDate, selectedUserId, defaultDuration, scheduleFor, closureOn, openingHours } = useCalendar();
	const queryClient = useQueryClient();
	const t = useTranslations("agenda.form");
	const tc = useTranslations("common");
	const kinds = useTranslations("absences.kinds");
	const format = useFormat();
	const fmt = useFmt();
	// The motif is one of the cabinet's acts (Paramètres › Tarifs).
	const acts = useQuery({ queryKey: ["acts"], queryFn: () => api<Act[]>("/acts") });

	const reasonRequired = !event || !!event.reason;

	const defaults = (): Values => {
		if (event) {
			const start = parseISO(event.startDate);
			return {
				patient: event.patient,
				practitionerId: event.user.id,
				date: formatDay(start, "yyyy-MM-dd"),
				time: formatDay(start, "HH:mm"),
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
			date: formatDay(startDate ?? selectedDate, "yyyy-MM-dd"),
			time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
			duration: defaultDuration,
			reason: "",
			notes: "",
		};
	};

	const form = useForm<Values>({
		resolver: zodResolver(schemaOf(t, reasonRequired)),
		defaultValues: defaults(),
	});
	/** The practitioner is already booked then: the message, until the user decides. */
	const [overlap, setOverlap] = useState<string | null>(null);
	const { errors, isSubmitting } = form.formState;
	const durations = [...new Set([...DURATIONS, form.getValues("duration")])].sort((a, b) => a - b);
	const [date, time, duration, practitionerId] = useWatch({
		control: form.control,
		name: ["date", "time", "duration", "practitionerId"],
	});
	const slotStart = date && /^\d{2}:\d{2}$/.test(time) ? new Date(`${date}T${time}`) : null;
	// Refused (the API too), unless an existing appointment simply keeps its time.
	const keepsTime =
		!!event && !!slotStart && slotStart.getTime() === parseISO(event.startDate).getTime() && duration === differenceInMinutes(parseISO(event.endDate), parseISO(event.startDate));
	const outsideHours =
		slotStart && !keepsTime && !Number.isNaN(slotStart.getTime()) && !isWithinWorkingHours(slotStart, addMinutes(slotStart, duration), scheduleFor(practitionerId))
			? slotStart
			: null;

	/** Why the slot can't be booked: a public holiday, a closure, an absence, or the hours. */
	const closedReason = (day: Date) => {
		const holiday = holidayOf(day);
		if (holiday) return t("holiday", { holiday: tc(`holidays.names.${holiday.key}`) });
		const closure = closureOn(day, practitionerId);
		if (closure) {
			const kind = kinds(closure.kind).toLowerCase();
			return closure.practitionerId
				? t("practitionerAbsent", { practitioner: closure.practitionerName ?? "", kind })
				: t("cabinetClosed", { kind });
		}
		return t("closed", {
			day: fmt(day, "EEEE"),
			hours: format.periods(openingHours[String(day.getDay()) as keyof typeof openingHours]).toLowerCase(),
		});
	};

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
			toast.success(event ? t("edited") : t("added"));
			await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			setOpen(false);
		} catch (err) {
			if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
				setOverlap(err.message);
				return;
			}
			form.setError("root", { message: err instanceof Error ? err.message : t("saveError") });
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
						<DialogTitle>{event ? t("editTitle") : t("newTitle")}</DialogTitle>
						<DialogDescription>
							{users.length ? t("slotHint") : t("noPractitioner")}
						</DialogDescription>
					</DialogHeader>

					<FieldGroup className="gap-4">
						<Controller
							control={form.control}
							name="patient"
							render={({ field }) => (
								<Field data-invalid={!!errors.patient}>
									<FieldLabel htmlFor="appointment-patient">{t("patient")}</FieldLabel>
									<PatientPicker
										id="appointment-patient"
										value={field.value}
										onChange={field.onChange}
										invalid={!!errors.patient}
									/>
									<FieldError errors={[errors.patient]} />
									<NoShowNote count={(field.value as PickedPatient | null)?.noShows} />
								</Field>
							)}
						/>

						<Controller
							control={form.control}
							name="practitionerId"
							render={({ field }) => (
								<Field data-invalid={!!errors.practitionerId}>
									<FieldLabel htmlFor="appointment-practitioner">{t("practitioner")}</FieldLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="appointment-practitioner" className="w-full" aria-invalid={!!errors.practitionerId}>
											<SelectValue placeholder={t("choose")} />
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
								<FieldLabel htmlFor="appointment-date">{t("date")}</FieldLabel>
								<Input id="appointment-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
								<FieldError errors={[errors.date]} />
							</Field>
							<Field data-invalid={!!errors.time}>
								<FieldLabel htmlFor="appointment-time">{t("time")}</FieldLabel>
								<Input id="appointment-time" type="time" step={300} aria-invalid={!!errors.time} {...form.register("time")} />
								<FieldError errors={[errors.time]} />
							</Field>
							<Controller
								control={form.control}
								name="duration"
								render={({ field }) => (
									<Field>
										<FieldLabel htmlFor="appointment-duration">{t("duration")}</FieldLabel>
										<Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
											<SelectTrigger id="appointment-duration" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{durations.map((d) => (
													<SelectItem key={d} value={String(d)}>
														{format.duration(d)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							/>
						</div>

						{outsideHours && (
							<p role="alert" className="text-destructive -mt-2 flex items-start gap-1.5 text-xs">
								<IconClock className="mt-px size-3.5 shrink-0" />
								<span>{closedReason(outsideHours)}</span>
							</p>
						)}

						<Field data-invalid={!!errors.reason}>
							<FieldLabel htmlFor="appointment-reason">{t("reason")}</FieldLabel>
							<Controller
								control={form.control}
								name="reason"
								render={({ field }) => (
									// A motif typed before tarifs were used stays shown as it is.
									<ActPicker
										id="appointment-reason"
										acts={acts.data ?? []}
										value={field.value}
										onChange={(act) => field.onChange(act?.name ?? "")}
										none={reasonRequired ? undefined : t("noReason")}
										placeholder={t("reasonPlaceholder")}
										invalid={!!errors.reason}
										disabled={acts.isPending || (acts.data?.length === 0 && !field.value)}
									/>
								)}
							/>
							{acts.isSuccess && acts.data.length === 0 && (
								<p className="text-muted-foreground text-xs">{t("noActs")}</p>
							)}
							<FieldError errors={[errors.reason]} />
						</Field>

						<Field data-invalid={!!errors.notes}>
							<FieldLabel htmlFor="appointment-notes">{t("notes")}</FieldLabel>
							<Textarea id="appointment-notes" rows={2} placeholder={t("optional")} {...form.register("notes")} />
						</Field>
					</FieldGroup>

					{errors.root && (
						<p role="alert" className="text-destructive text-sm">
							{errors.root.message}
						</p>
					)}
					{overlap && (
						<div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
							<IconWarning className="mt-0.5 size-4 shrink-0" />
							<div className="grid gap-2">
								<p>
									{overlap} {t("bookQuestion")}
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-fit bg-background"
									disabled={isSubmitting || !!outsideHours}
									onClick={form.handleSubmit((values) => save(values, true))}
								>
									{t("bookAnyway")}
								</Button>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("cancel")}
						</Button>
						<Button type="submit" disabled={isSubmitting || !users.length || !!outsideHours}>
							{isSubmitting && <IconSpinner className="size-4 animate-spin" />}
							{event ? t("save") : t("add")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
