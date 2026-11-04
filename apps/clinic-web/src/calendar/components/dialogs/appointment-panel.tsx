"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  LuArmchair,
  LuCalendar,
  LuChevronDown,
  LuClock,
  LuExternalLink,
  LuFileText,
  LuHistory,
  LuLoader,
  LuLogOut,
  LuPencil,
  LuPhone,
  LuReceipt,
  LuShieldCheck,
  LuStethoscope,
  LuText,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";
import Link from "next/link";
import { toast } from "sonner";

import { CheckoutDialog } from "@/app/(clinic)/payments/_components/checkout-dialog";
import { PatientBalance } from "@/app/(clinic)/patients/_components/patient-payments";
import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { IEvent } from "@/calendar/interfaces";
import { useFmt } from "@/calendar/locale";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { useCurrentUser } from "@/components/current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SHEET_AT_END, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api-client";
import {
  type Appointment,
  APPOINTMENT_STATUSES,
  APPOINTMENTS_KEY,
  type AppointmentStatus,
  patchAppointment,
} from "@/lib/appointments";
import {
  ageOf,
  formatFileNumber,
  formatPhone,
  isMedicalRole,
  type PatientFile,
  patientHref,
} from "@/lib/patients";
import { useFormat } from "@/lib/use-format";
import { useWaitingActions } from "@/lib/use-waiting-actions";

/** The usual next step: the desk checks patients in, the doctor calls them in and finishes. */
const NEXT_STEP: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: "arrived" | "call" | "finish" }>> = {
  scheduled: { status: "arrived", label: "arrived" },
  confirmed: { status: "arrived", label: "arrived" },
  arrived: { status: "in_consultation", label: "call" },
  in_consultation: { status: "completed", label: "finish" },
};
/** The doctor's statuses: the front desk neither sets them nor changes them. */
const DOCTOR_STATUSES: AppointmentStatus[] = ["in_consultation", "completed"];

/** From this width the panel sits beside the calendar; below, it slides over it. */
const WIDE = "(min-width: 1280px)";
const subscribe = (change: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
const useWide = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

/**
 * The open appointment, next to the agenda instead of over it: the calendar
 * stays usable, and clicking another appointment just changes the panel.
 */
export function AppointmentPanel() {
  const { detailsId, closeDetails } = useAppointmentDialogs();
  const { events } = useCalendar();
  const wide = useWide();
  const t = useTranslations("agenda.panel");
  const event = events.find((e) => e.id === detailsId);

  useEffect(() => {
    if (!event) return;
    // Escape belongs to any dialog or menu open above the panel first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"], [role="menu"]')) closeDetails();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, closeDetails]);

  if (!event) return null;

  return wide ? (
    <aside
      aria-label={t("appointment")}
      className="bg-card sticky top-16 flex max-h-[calc(100svh-5.5rem)] w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border"
    >
      <PanelContent key={event.id} event={event} onClose={closeDetails} />
    </aside>
  ) : (
    <Sheet modal={false} open onOpenChange={(open) => !open && closeDetails()}>
      <SheetContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={`w-full gap-0 overflow-hidden data-[side=right]:sm:max-w-sm ${SHEET_AT_END}`}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{t("appointment")}</SheetTitle>
        <PanelContent key={event.id} event={event} onClose={closeDetails} />
      </SheetContent>
    </Sheet>
  );
}

function PanelContent({ event, onClose }: { event: IEvent; onClose: () => void }) {
  const { canWrite } = useCalendar();
  const { openEdit } = useAppointmentDialogs();
  const { role } = useCurrentUser();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const t = useTranslations();
  const panel = useTranslations("agenda.panel");
  const statusLabel = useTranslations("common.appointmentStatus");
  const format = useFormat();
  const fmt = useFmt();

  const patientId = event.patient.id;
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const doctor = isMedicalRole(role);
  const step = NEXT_STEP[event.status];
  const next = step && (doctor || !DOCTOR_STATUSES.includes(step.status)) ? step : undefined;
  const lockedForDesk = !doctor && DOCTOR_STATUSES.includes(event.status);
  const waiting = useWaitingActions();

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api<PatientFile>(`/patients/${patientId}`),
  });
  const { data: history } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: () => api<Appointment[]>(`/appointments?patientId=${patientId}`),
  });
  const lastVisit = history?.find((a) => a.status === "completed" && a.id !== event.id && parseISO(a.startsAt) < start);
  const allergies = isMedicalRole(role) ? patient?.medicalProfile?.allergies : null;
  const age = patient ? ageOf(patient.birthDate) : null;

  async function setStatus(status: AppointmentStatus) {
    setBusy(true);
    // Shown at once (badge, colour, next step); undone if the server refuses.
    const undo = patchAppointment(queryClient, event.id, {
      status,
      ...(status === "arrived" && { arrivedAt: new Date().toISOString() }),
    });
    try {
      await api(`/appointments/${event.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast.success(panel("statusChanged", { status: statusLabel(status).toLowerCase() }));
    } catch (err) {
      undo();
      toast.error(err instanceof Error ? err.message : panel("statusError"));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["patient-appointments", patientId] });
    }
  }

  return (
    <>
      <header className="grid gap-2 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="grid min-w-0 gap-0.5">
            <h2 className="truncate font-semibold">{event.title}</h2>
            <p className="text-muted-foreground text-sm tabular-nums">{formatFileNumber(event.patient.fileNumber)}</p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={t("common.close")} onClick={onClose}>
            <LuX />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <AppointmentStatusBadge status={event.status} />
          <Link
            href={patientHref(patientId)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            {panel("openFile")} <LuExternalLink className="size-3 rtl:-scale-x-100" />
          </Link>
        </div>
      </header>

      <div className="grid flex-1 content-start gap-5 overflow-y-auto p-4 text-sm">
        <section className="grid gap-3" aria-label={panel("appointment")}>
          <Row icon={LuCalendar}>
            <span className="inline-block first-letter:uppercase">{fmt(start, "EEEE d MMMM yyyy")}</span>
          </Row>
          <Row icon={LuClock}>
            {fmt(start, "HH:mm")} – {fmt(end, "HH:mm")}
            <span className="text-muted-foreground"> · {panel("minutes", { count: differenceInMinutes(end, start) })}</span>
          </Row>
          <Row icon={LuStethoscope}>{event.user.name}</Row>
          {event.reason && <Row icon={LuText}>{event.reason}</Row>}
          {event.notes && (
            <Row icon={LuFileText}>
              <span className="whitespace-pre-line">{event.notes}</span>
            </Row>
          )}
        </section>

        <section className="grid gap-3 border-t pt-4" aria-label={panel("patient")}>
          {allergies && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="font-semibold">{panel("allergies")} </span>
                {allergies}
              </span>
            </p>
          )}
          <PatientBalance patientId={patientId} />
          {patient && (
            <p className="text-muted-foreground">
              {t(`common.sex.${patient.sex}`)}
              {age !== null && `, ${t("common.age", { age })}`}
            </p>
          )}
          {event.patient.phone && (
            <Row icon={LuPhone}>
              <a href={`tel:${event.patient.phone}`} className="tabular-nums hover:underline">
                {formatPhone(event.patient.phone)}
              </a>
            </Row>
          )}
          {patient && <Row icon={LuShieldCheck}>{t(`common.coverage.${patient.coverage}`)}</Row>}
          {history && (
            <Row icon={LuHistory}>
              {lastVisit ? panel("lastVisit", { date: format.date(lastVisit.startsAt) }) : panel("firstVisit")}
            </Row>
          )}
        </section>
      </div>

      {canWrite && (
        <footer className="grid gap-2 border-t p-4">
          {next && (
            <Button type="button" disabled={busy} onClick={() => setStatus(next.status)}>
              {busy && <LuLoader className="size-4 animate-spin" />}
              {panel(next.label)}
            </Button>
          )}
          {!doctor && event.status === "arrived" && (
            <>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                <LuArmchair className="size-3.5" /> {panel("waitingDoctor")}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || waiting.busy === event.id}
                onClick={() => waiting.left(event)}
              >
                <LuLogOut className="size-4 rtl:-scale-x-100" />
                {t("agenda.waiting.left")}
              </Button>
            </>
          )}
          {lockedForDesk && (
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
              <LuStethoscope className="size-3.5" /> {panel("doctorStep")}
            </p>
          )}
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy || lockedForDesk}>
                  {panel("status")}
                  <LuChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  {panel("changeStatus")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {APPOINTMENT_STATUSES.filter((s) => s !== event.status && (doctor || !DOCTOR_STATUSES.includes(s))).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onSelect={() => setStatus(s)}
                    variant={s === "cancelled" ? "destructive" : "default"}
                  >
                    {statusLabel(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {event.status !== "cancelled" && (
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => setCheckout(true)}>
                <LuReceipt className="size-4" />
                {panel("collect")}
              </Button>
            )}
            {event.status !== "completed" && (
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => openEdit(event)}>
                <LuPencil className="size-4" />
                {panel("edit")}
              </Button>
            )}
          </div>
        </footer>
      )}
      <CheckoutDialog appointmentId={checkout ? event.id : null} onOpenChange={setCheckout} />
    </>
  );
}

function Row({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
