import { useTranslations } from "next-intl";

import { type AppIcon, IconCalendarRange, IconClose, IconColumns, IconGrid, IconGridLarge, IconList, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { UserSelect } from "@/calendar/components/header/user-select";
import { StatusFilter } from "@/calendar/components/header/status-filter";
import { ActFilter } from "@/calendar/components/header/act-filter";
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

/**
 * Two rows: where we are (today, the period, its arrows) with the views and
 * "Nouveau rendez-vous"; then the filters, with a reset once one is on.
 */
export function CalendarHeader({ view, events }: IProps) {
  const {
    setView,
    canWrite,
    selectedUserId,
    setSelectedUserId,
    selectedStatuses,
    setSelectedStatuses,
    selectedActs,
    setSelectedActs,
  } = useCalendar();
  const { openCreate } = useAppointmentDialogs();
  const t = useTranslations("agenda");
  const filtered = selectedUserId !== "all" || selectedStatuses.length > 0 || selectedActs.length > 0;

  return (
    // Sized on the agenda's own width (container query), not the window's:
    // next to the sidebar, a wide window can still leave too little room.
    <div className="@container grid gap-3 border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TodayButton />
          <DateNavigator view={view} events={events} />
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label={t("views.group")} className="bg-muted inline-flex rounded-lg p-0.5">
            {VIEWS.map(({ view: v, icon: Icon }) => (
              <button
                key={v}
                type="button"
                aria-label={t("views.label", { view: t(`views.${v}`).toLowerCase() })}
                aria-pressed={view === v}
                title={t(`views.${v}`)}
                onClick={() => setView(v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors [&_svg]:size-4.5",
                  view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon strokeWidth={1.8} />
              </button>
            ))}
          </div>

          {canWrite && (
            <Button type="button" className="h-9" onClick={() => openCreate()}>
              <IconPlus />
              <span className="hidden @lg:inline">{t("newAppointment")}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <UserSelect />
          <StatusFilter />
          <ActFilter />
        </div>
        {filtered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-9"
            onClick={() => {
              setSelectedUserId("all");
              setSelectedStatuses([]);
              setSelectedActs([]);
            }}
          >
            <IconClose /> {t("resetFilters")}
          </Button>
        )}
      </div>
    </div>
  );
}
