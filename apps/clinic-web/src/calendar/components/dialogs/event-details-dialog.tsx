"use client";

import { useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes, parseISO } from "date-fns";
import { CalendarIcon, ChevronDown, Clock, FileText, Loader, Pencil, Phone, Stethoscope, Text } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { IEvent } from "@/calendar/interfaces";
import { fmt } from "@/calendar/locale";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { APPOINTMENT_STATUSES, APPOINTMENTS_KEY, type AppointmentStatus, STATUS_LABELS } from "@/lib/appointments";
import { formatFileNumber, formatPhone, patientHref } from "@/lib/patients";

/** The usual next step at the front desk. */
const NEXT_STEP: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string }>> = {
  scheduled: { status: "arrived", label: "Patient arrivé" },
  confirmed: { status: "arrived", label: "Patient arrivé" },
  arrived: { status: "in_consultation", label: "Faire entrer" },
  in_consultation: { status: "completed", label: "Terminer" },
};

export function EventDetailsDialog({ event, children }: { event: IEvent; children: React.ReactNode }) {
  const { canWrite } = useCalendar();
  const { openEdit } = useAppointmentDialogs();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const next = NEXT_STEP[event.status];

  async function setStatus(status: AppointmentStatus) {
    setBusy(true);
    try {
      await api(`/appointments/${event.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast.success(`Rendez-vous : ${STATUS_LABELS[status].toLowerCase()}`);
      await queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Changement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pe-6">
            <div className="grid min-w-0 gap-0.5">
              <DialogTitle className="truncate">
                <Link href={patientHref(event.patient.id)} className="hover:underline">
                  {event.title}
                </Link>
              </DialogTitle>
              <DialogDescription className="tabular-nums">{formatFileNumber(event.patient.fileNumber)}</DialogDescription>
            </div>
            <AppointmentStatusBadge status={event.status} />
          </div>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <Row icon={Stethoscope}>{event.user.name}</Row>
          <Row icon={CalendarIcon}>
            <span className="inline-block first-letter:uppercase">{fmt(start, "EEEE d MMMM yyyy")}</span>
          </Row>
          <Row icon={Clock}>
            {fmt(start, "HH:mm")} – {fmt(end, "HH:mm")}
            <span className="text-muted-foreground"> · {differenceInMinutes(end, start)} min</span>
          </Row>
          {event.patient.phone && (
            <Row icon={Phone}>
              <a href={`tel:${event.patient.phone}`} className="tabular-nums hover:underline">
                {formatPhone(event.patient.phone)}
              </a>
            </Row>
          )}
          {event.reason && <Row icon={Text}>{event.reason}</Row>}
          {event.notes && (
            <Row icon={FileText}>
              <span className="whitespace-pre-line">{event.notes}</span>
            </Row>
          )}
        </div>

        {canWrite && (
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" disabled={busy}>
                    Statut
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Changer le statut</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {APPOINTMENT_STATUSES.filter((s) => s !== event.status).map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => setStatus(s)} variant={s === "cancelled" ? "destructive" : "default"}>
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {event.status !== "completed" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    openEdit(event);
                  }}
                >
                  <Pencil className="size-4" />
                  Modifier
                </Button>
              )}
            </div>
            {next && (
              <Button type="button" disabled={busy} onClick={() => setStatus(next.status)}>
                {busy && <Loader className="size-4 animate-spin" />}
                {next.label}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
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
