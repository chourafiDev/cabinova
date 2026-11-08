import { useTranslations } from "next-intl";

import { type AppIcon, IconCalendarRange, IconColumns, IconGrid, IconGridLarge, IconList, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { UserSelect } from "@/calendar/components/header/user-select";
import { StatusFilter } from "@/calendar/components/header/status-filter";
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

const VIEWS: { view: TCalendarView; icon: AppIcon }[] = [
  { view: "day", icon: IconList },
  { view: "week", icon: IconColumns },
  { view: "month", icon: IconGrid },
  { view: "year", icon: IconGridLarge },
  { view: "agenda", icon: IconCalendarRange },
];

export function CalendarHeader({ view, events }: IProps) {
  const { setView, canWrite } = useCalendar();
  const { openCreate } = useAppointmentDialogs();
  const t = useTranslations("agenda");

  return (
    // Sized on the agenda's own width (container query), not the window's:
    // next to the sidebar, a wide window can still leave too little room.
    <div className="@container border-b p-4">
    <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-center @4xl:justify-between">
      <div className="flex items-center gap-3">
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex">
            {VIEWS.map(({ view: v, icon: Icon }, index) => (
              <Button
                key={v}
                type="button"
                aria-label={t("views.label", { view: t(`views.${v}`).toLowerCase() })}
                title={t(`views.${v}`)}
                size="icon"
                variant={view === v ? "default" : "outline"}
                onClick={() => setView(v)}
                className={cn(
                  "[&_svg]:size-5 h-10 !shadow-none",
                  index === 0 ? "rounded-e-none" : index === VIEWS.length - 1 ? "-ms-px rounded-s-none" : "-ms-px rounded-none",
                )}
              >
                <Icon strokeWidth={1.8} />
              </Button>
            ))}
          </div>

          <UserSelect />
          <StatusFilter />
        </div>

        {canWrite && (
          <Button type="button" className="w-full sm:w-auto" onClick={() => openCreate()}>
            <IconPlus />
            {t("newAppointment")}
          </Button>
        )}
      </div>
    </div>
    </div>
  );
}
