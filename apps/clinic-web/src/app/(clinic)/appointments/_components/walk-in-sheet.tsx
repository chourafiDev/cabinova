"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuCalendarCheck, LuLoader, LuTriangleAlert, LuUndo2 } from "react-icons/lu";
import { toast } from "sonner";
import { type PickedPatient, PatientPicker } from "@/components/patient-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Sheet,
	SHEET_AT_END,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY, type Practitioner, patchAppointment } from "@/lib/appointments";
import { EMPTY_PATIENT } from "@/lib/patients";
import { ActPicker } from "@/components/act-picker";
import type { Act } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { useWaitingActions } from "@/lib/use-waiting-actions";
import { PatientForm } from "../../patients/_components/patient-form";
import { useToday } from "./use-today";

type Errors = Partial<Record<"patient" | "practitioner" | "reason", string>>;

/**
 * A patient who came without an appointment, seen today: an existing file
 * or a new one, then the doctor and the act. They join the waiting room in
 * arrival order, and the visit takes its place in the agenda from now.
 */
export function WalkInSheet({
	practitioners,
	open,
	onOpenChange,
}: {
	practitioners: Practitioner[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("agenda.walkIn");
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className={`w-full gap-0 data-[side=right]:sm:max-w-2xl ${SHEET_AT_END}`}>
				<SheetHeader className="border-b p-5">
					<SheetTitle className="text-xl">{t("title")}</SheetTitle>
					<SheetDescription>{t("description")}</SheetDescription>
				</SheetHeader>
				{/* Remounted on each opening: a fresh form every time. */}
				{open && <WalkInForm practitioners={practitioners} onDone={() => onOpenChange(false)} />}
			</SheetContent>
		</Sheet>
	);
}

function WalkInForm({ practitioners, onDone }: { practitioners: Practitioner[]; onDone: () => void }) {
	const t = useTranslations("agenda.walkIn");
	const form = useTranslations("agenda.form");
	const panel = useTranslations("agenda.panel");
	const statusLabel = useTranslations("common.appointmentStatus");
	const fmt = useFormat();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<"existing" | "new">("existing");
	const [patient, setPatient] = useState<PickedPatient | null>(null);
	const [practitionerId, setPractitionerId] = useState(practitioners[0]?.id ?? "");
	const [reason, setReason] = useState("");
	const [notes, setNotes] = useState("");
	const [errors, setErrors] = useState<Errors>({});
	const [saving, setSaving] = useState(false);
	const acts = useQuery({ queryKey: ["acts"], queryFn: () => api<Act[]>("/acts") });
	const today = useToday();

	// Already here today, or expected later: the desk checks them in instead.
	const todays = patient ? (today.data ?? []).filter((a) => a.patient.id === patient.id) : [];
	const present = todays.find((a) => a.status === "arrived" || a.status === "in_consultation");
	const booked = todays.find((a) => a.status === "scheduled" || a.status === "confirmed");
	// Left unseen earlier today: back into the waiting room rather than a second visit.
	const gone = todays.find((a) => a.status === "cancelled" && a.leftAt);
	const actions = useWaitingActions();

	const pick = (p: PickedPatient) => {
		setPatient(p);
		setErrors((e) => ({ ...e, patient: undefined }));
	};

	async function checkIn(a: Appointment) {
		setSaving(true);
		const undo = patchAppointment(queryClient, a.id, { status: "arrived", arrivedAt: new Date().toISOString() });
		try {
			await api(`/appointments/${a.id}/status`, { method: "POST", body: JSON.stringify({ status: "arrived" }) });
			toast.success(panel("statusChanged", { status: statusLabel("arrived").toLowerCase() }));
			onDone();
		} catch (err) {
			undo();
			toast.error(err instanceof Error ? err.message : panel("statusError"));
		} finally {
			setSaving(false);
			void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
		}
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const next: Errors = {
			patient: patient ? undefined : form("choosePatient"),
			practitioner: practitionerId ? undefined : form("choosePractitioner"),
			reason: reason ? undefined : form("chooseReason"),
		};
		setErrors(next);
		if (Object.values(next).some(Boolean) || !patient || present || gone) return;
		setSaving(true);
		try {
			await api<Appointment>("/appointments/walk-in", {
				method: "POST",
				body: JSON.stringify({ patientId: patient.id, practitionerId, reason, notes }),
			});
			toast.success(t("added"));
			await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
			onDone();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Tabs
			value={tab}
			onValueChange={(v) => setTab(v as "existing" | "new")}
			className="flex min-h-0 flex-1 flex-col gap-0"
		>
			<div className="border-b px-5 py-3">
				<TabsList className="w-full">
					<TabsTrigger value="existing">{t("existing")}</TabsTrigger>
					<TabsTrigger value="new">{t("new")}</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="new" className="flex min-h-0 flex-col">
				<PatientForm
					defaultValues={EMPTY_PATIENT}
					submitLabel={t("createAndContinue")}
					autoFocus={false}
					onCancel={onDone}
					onSaved={(created) => {
						// Back to the visit, the new file already chosen.
						pick({
							id: created.id,
							firstName: created.firstName,
							lastName: created.lastName,
							fileNumber: created.fileNumber,
						});
						setTab("existing");
					}}
				/>
			</TabsContent>

			<TabsContent value="existing" className="flex min-h-0 flex-col">
				<form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
					<FieldGroup className="min-h-0 flex-1 content-start overflow-y-auto p-5">
						<Field data-invalid={!!errors.patient}>
							<FieldLabel htmlFor="walk-in-patient">{form("patient")}</FieldLabel>
							<PatientPicker id="walk-in-patient" value={patient} onChange={pick} invalid={!!errors.patient} />
							<FieldError errors={[errors.patient ? { message: errors.patient } : undefined]} />
							{!patient && (
								<p className="text-muted-foreground text-xs">
									{t("notFound")}{" "}
									<button
										type="button"
										className="text-primary font-medium hover:underline"
										onClick={() => setTab("new")}
									>
										{t("createFile")}
									</button>
								</p>
							)}
						</Field>

						{present ? (
							<p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
								<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
								{statusLabel(present.status)} · {t("alreadyHere")}
							</p>
						) : gone ? (
							<div className="grid gap-2 rounded-lg border bg-accent/50 p-3 text-sm">
								<p className="flex items-start gap-2">
									<LuUndo2 className="text-primary mt-0.5 size-4 shrink-0 rtl:-scale-x-100" />
									{t("goneToday", { time: gone.leftAt ? fmt.clock(gone.leftAt) : "—" })}
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-fit"
									disabled={actions.busy === gone.id}
									onClick={async () => {
										if (await actions.back(gone)) onDone();
									}}
								>
									{t("putBack")}
								</Button>
							</div>
						) : booked ? (
							<div className="grid gap-2 rounded-lg border bg-accent/50 p-3 text-sm">
								<p className="flex items-start gap-2">
									<LuCalendarCheck className="text-primary mt-0.5 size-4 shrink-0" />
									{t("hasAppointment", { time: fmt.clock(booked.startsAt), doctor: booked.practitioner.name })}
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-fit"
									disabled={saving}
									onClick={() => checkIn(booked)}
								>
									{t("checkIn")}
								</Button>
							</div>
						) : null}

						<Field data-invalid={!!errors.practitioner}>
							<FieldLabel htmlFor="walk-in-practitioner">{form("practitioner")}</FieldLabel>
							<Select value={practitionerId} onValueChange={setPractitionerId}>
								<SelectTrigger id="walk-in-practitioner" className="w-full" aria-invalid={!!errors.practitioner}>
									<SelectValue placeholder={form("choose")} />
								</SelectTrigger>
								<SelectContent>
									{practitioners.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={[errors.practitioner ? { message: errors.practitioner } : undefined]} />
						</Field>

						<Field data-invalid={!!errors.reason}>
							<FieldLabel htmlFor="walk-in-reason">{form("reason")}</FieldLabel>
							<ActPicker
								id="walk-in-reason"
								acts={acts.data ?? []}
								value={reason}
								onChange={(act) => {
									setReason(act?.name ?? "");
									setErrors((e) => ({ ...e, reason: undefined }));
								}}
								placeholder={form("reasonPlaceholder")}
								invalid={!!errors.reason}
								disabled={acts.isPending || acts.data?.length === 0}
							/>
							{acts.isSuccess && acts.data.length === 0 && (
								<p className="text-muted-foreground text-xs">{form("noActs")}</p>
							)}
							<FieldError errors={[errors.reason ? { message: errors.reason } : undefined]} />
						</Field>

						<Field>
							<FieldLabel htmlFor="walk-in-notes">{form("notes")}</FieldLabel>
							<Textarea
								id="walk-in-notes"
								rows={2}
								maxLength={2000}
								placeholder={form("optional")}
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</Field>
					</FieldGroup>

					<div className="flex items-center gap-2 border-t px-5 py-3">
						<p className="text-muted-foreground me-auto hidden text-xs sm:block">{t("fromNow")}</p>
						<Button type="button" variant="ghost" onClick={onDone}>
							{form("cancel")}
						</Button>
						<Button type="submit" disabled={saving || !!present || !!gone}>
							{saving && <LuLoader className="animate-spin" />}
							{t("submit")}
						</Button>
					</div>
				</form>
			</TabsContent>
		</Tabs>
	);
}
