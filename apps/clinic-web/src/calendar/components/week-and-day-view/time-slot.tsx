"use client";

import { AddEventDialog } from "@/calendar/components/dialogs/add-event-dialog";
import { DroppableTimeBlock } from "@/calendar/components/dnd/droppable-time-block";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { isWorkingHour, isWorkingSlot } from "@/calendar/helpers";
import { cn } from "@/lib/utils";

/**
 * One quarter of an hour (24px). A fully closed hour is hatched as a whole;
 * here, only the closed part of an open one. Closed slots still open the
 * form: the form and the API are what refuse them.
 */
export function TimeSlot({ date, hour, minute }: { date: Date; hour: number; minute: number }) {
  const { workingHours } = useCalendar();
  const partlyClosed = isWorkingHour(date, hour, workingHours) && !isWorkingSlot(date, hour, minute, workingHours);

  return (
    <DroppableTimeBlock date={date} hour={hour} minute={minute}>
      <AddEventDialog startDate={date} startTime={{ hour, minute }}>
        <div
          className={cn("absolute inset-x-0 h-[24px] cursor-pointer transition-colors hover:bg-accent", partlyClosed && "bg-calendar-disabled-hour")}
          style={{ top: `${(minute / 15) * 24}px` }}
        />
      </AddEventDialog>
    </DroppableTimeBlock>
  );
}
