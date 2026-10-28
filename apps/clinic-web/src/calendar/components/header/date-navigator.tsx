import { fmt } from "@/calendar/locale";
import { useMemo } from "react";

import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import { useCalendar } from "@/calendar/contexts/calendar-context";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getEventsCount, navigateDate, rangeText } from "@/calendar/helpers";

import type { IEvent } from "@/calendar/interfaces";
import type { TCalendarView } from "@/calendar/types";

interface IProps {
  view: TCalendarView;
  events: IEvent[];
}

export function DateNavigator({ view, events }: IProps) {
  const { selectedDate, setSelectedDate } = useCalendar();

  const month = fmt(selectedDate, "LLLL");
  const year = selectedDate.getFullYear();

  const eventCount = useMemo(() => getEventsCount(events, selectedDate, view), [events, selectedDate, view]);

  const handlePrevious = () => setSelectedDate(navigateDate(selectedDate, view, "previous"));
  const handleNext = () => setSelectedDate(navigateDate(selectedDate, view, "next"));

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold capitalize">
          {month} {year}
        </span>
        <Badge variant="outline" className="px-1.5">
          {eventCount} rendez-vous
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" aria-label="Période précédente" className="size-6.5 px-0 [&_svg]:size-4.5" onClick={handlePrevious}>
          <LuChevronLeft />
        </Button>

        <p className="text-sm text-muted-foreground">{rangeText(view, selectedDate)}</p>

        <Button variant="outline" aria-label="Période suivante" className="size-6.5 px-0 [&_svg]:size-4.5" onClick={handleNext}>
          <LuChevronRight />
        </Button>
      </div>
    </div>
  );
}
