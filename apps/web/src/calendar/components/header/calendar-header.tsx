import { CalendarRange, Columns, Grid2x2, Grid3x3, List, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { UserSelect } from "@/calendar/components/header/user-select";
import { TodayButton } from "@/calendar/components/header/today-button";
import { DateNavigator } from "@/calendar/components/header/date-navigator";
import { useAppointmentDialogs } from "@/calendar/components/dialogs/appointment-dialogs";

import { cn } from "@/lib/utils";

import type { IEvent } from "@/calendar/interfaces";
import type { TCalendarView } from "@/calendar/types";

interface IProps {
  view: TCalendarView;
  events: IEvent[];
}

const VIEWS: { view: TCalendarView; label: string; icon: React.ComponentType<{ strokeWidth?: number }> }[] = [
  { view: "day", label: "Jour", icon: List },
  { view: "week", label: "Semaine", icon: Columns },
  { view: "month", label: "Mois", icon: Grid2x2 },
  { view: "year", label: "Année", icon: Grid3x3 },
  { view: "agenda", label: "Liste", icon: CalendarRange },
];

export function CalendarHeader({ view, events }: IProps) {
  const { setView, canWrite } = useCalendar();
  const { openCreate } = useAppointmentDialogs();

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex">
            {VIEWS.map(({ view: v, label, icon: Icon }, index) => (
              <Button
                key={v}
                type="button"
                aria-label={`Vue ${label.toLowerCase()}`}
                title={label}
                size="icon"
                variant={view === v ? "default" : "outline"}
                onClick={() => setView(v)}
                className={cn(
                  "[&_svg]:size-5",
                  index === 0 ? "rounded-r-none" : index === VIEWS.length - 1 ? "-ml-px rounded-l-none" : "-ml-px rounded-none",
                )}
              >
                <Icon strokeWidth={1.8} />
              </Button>
            ))}
          </div>

          <UserSelect />
        </div>

        {canWrite && (
          <Button type="button" className="w-full sm:w-auto" onClick={() => openCreate()}>
            <Plus />
            Nouveau rendez-vous
          </Button>
        )}
      </div>
    </div>
  );
}
