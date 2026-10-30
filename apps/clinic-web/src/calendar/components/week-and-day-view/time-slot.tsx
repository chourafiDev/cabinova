"use client";

import { AddEventDialog } from "@/calendar/components/dialogs/add-event-dialog";
import { DroppableTimeBlock } from "@/calendar/components/dnd/droppable-time-block";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { isWorkingHour, isWorkingSlot } from "@/calendar/helpers";
import { cn } from "@/lib/utils";

/** One quarter of an hour (24px). Outside opening hours it takes no booking and no drop. */
export function TimeSlot({ date, hour, minute }: { date: Date; hour: number; minute: number }) {
  const { workingHours } = useCalendar();
  const top = { top: `${(minute / 15) * 24}px` };

  if (!isWorkingSlot(date, hour, minute, workingHours)) {
    return (
      <div
        title="Cabinet fermé"
        // A fully closed hour is hatched as a whole; here, only the closed part of an open one.
        className={cn("absolute inset-x-0 h-[24px] cursor-not-allowed", isWorkingHour(date, hour, workingHours) && "bg-calendar-disabled-hour")}
        style={top}
      />
    );
  }

  return (
    <DroppableTimeBlock date={date} hour={hour} minute={minute}>
      <AddEventDialog startDate={date} startTime={{ hour, minute }}>
        <div className="absolute inset-x-0 h-[24px] cursor-pointer transition-colors hover:bg-accent" style={top} />
      </AddEventDialog>
    </DroppableTimeBlock>
  );
}
