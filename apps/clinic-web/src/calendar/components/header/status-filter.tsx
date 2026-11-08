"use client";

import { useTranslations } from "next-intl";

import { EventBullet } from "@/calendar/components/month-view/event-bullet";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { IconChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APPOINTMENT_STATUSES, type AppointmentStatus, STATUS_COLORS } from "@/lib/appointments";
import { cn } from "@/lib/utils";

/** Status filter: tick the statuses to show, each in its agenda colour; none ticked shows them all. */
export function StatusFilter() {
  const { selectedStatuses, setSelectedStatuses } = useCalendar();
  const t = useTranslations("agenda.statusFilter");
  const status = useTranslations("common.appointmentStatus");

  const toggle = (s: AppointmentStatus, on: boolean) =>
    setSelectedStatuses(
      // Kept in the agenda's order, whatever the order of the clicks.
      APPOINTMENT_STATUSES.filter((x) => (x === s ? on : selectedStatuses.includes(x))),
    );
  const label =
    selectedStatuses.length === 0
      ? t("all")
      : selectedStatuses.length === 1
        ? status(selectedStatuses[0])
        : t("some", { count: selectedStatuses.length });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-10 flex-1 justify-between gap-2 font-normal md:w-52 md:flex-none", selectedStatuses.length > 0 && "border-primary")}
          aria-label={t("label")}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedStatuses.length > 0 && (
              <span className="flex shrink-0 -space-x-0.5">
                {selectedStatuses.slice(0, 4).map((s) => (
                  <EventBullet key={s} color={STATUS_COLORS[s]} className="ring-background ring-1" />
                ))}
              </span>
            )}
            <span className="truncate">{label}</span>
          </span>
          <IconChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <ul role="group" aria-label={t("label")}>
          {APPOINTMENT_STATUSES.map((s) => (
            <li key={s}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                <Checkbox
                  checked={selectedStatuses.includes(s)}
                  onCheckedChange={(on) => toggle(s, on === true)}
                  aria-label={status(s)}
                />
                <EventBullet color={STATUS_COLORS[s]} className="shrink-0" />
                <span className={cn(s === "cancelled" && "line-through")}>{status(s)}</span>
              </label>
            </li>
          ))}
        </ul>
        {selectedStatuses.length > 0 && (
          <div className="mt-1 border-t pt-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={() => setSelectedStatuses([])}>
              {t("reset")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
