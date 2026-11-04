"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { IEvent, IUser } from "@/calendar/interfaces";
import type { TBadgeVariant, TCalendarView, TSchedule, TVisibleHours, TWorkingHours } from "@/calendar/types";
import { type Closure, covers, dayKey } from "@/lib/closures";
import type { OpeningHours } from "@/lib/session";
import { toMinutes } from "@/lib/settings";

interface ICalendarContext {
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date | undefined) => void;
  selectedUserId: IUser["id"] | "all";
  setSelectedUserId: (userId: IUser["id"] | "all") => void;
  badgeVariant: TBadgeVariant;
  setBadgeVariant: (variant: TBadgeVariant) => void;
  /** Practitioners */
  users: IUser[];
  /** The current space's opening hours (Paramètres › Horaires & agenda), as set… */
  openingHours: OpeningHours;
  /** …and in minutes, for the views. */
  workingHours: TWorkingHours;
  /**
   * What the views close: opening hours, public holidays, the cabinet's
   * closures, and the absences of the doctor shown (or of the only one).
   */
  schedule: TSchedule;
  /** The same for one doctor (the booking form). */
  scheduleFor: (practitionerId: string) => TSchedule;
  /** Why a day is closed for this doctor (or the whole cabinet), if it is. */
  closureOn: (day: Date, practitionerId: string | null) => Closure | undefined;
  /** Every closure on a day (labels in the views). */
  closuresOn: (day: Date) => Closure[];
  /** Rows shown on the day/week views: opening hours, widened by events outside them. */
  visibleHours: TVisibleHours;
  /** Pre-selected when booking (minutes). */
  defaultDuration: number;
  events: IEvent[];
  /** appointments:write — booking, drag & drop, status changes. */
  canWrite: boolean;
}

const CalendarContext = createContext<ICalendarContext | null>(null);

// Before a space has hours (or when it's closed all week).
const DEFAULT_VISIBLE_HOURS: TVisibleHours = { from: 8, to: 19 };

function workingHoursOf(openingHours: OpeningHours): TWorkingHours {
  return Object.fromEntries(
    Object.entries(openingHours).map(([day, periods]) => [
      Number(day),
      periods.map((p) => ({ from: toMinutes(p.from), to: toMinutes(p.to) })),
    ]),
  );
}

/** From the earliest opening to the latest closing of the week, in whole hours. */
function visibleHoursOf(workingHours: TWorkingHours): TVisibleHours {
  const periods = Object.values(workingHours).flat();
  if (!periods.length) return DEFAULT_VISIBLE_HOURS;
  return {
    from: Math.floor(Math.min(...periods.map((p) => p.from)) / 60),
    to: Math.min(24, Math.ceil(Math.max(...periods.map((p) => p.to)) / 60)),
  };
}

/**
 * Calendar state. Date, view and practitioner live in the URL (owned by the
 * page); the events come from the API for the visible range.
 */
export function CalendarProvider({
  children,
  users,
  events,
  view,
  setView,
  selectedDate,
  setSelectedDate,
  selectedUserId,
  setSelectedUserId,
  canWrite,
  openingHours,
  defaultDuration,
  closures = [],
}: {
  children: React.ReactNode;
  users: IUser[];
  events: IEvent[];
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedUserId: IUser["id"] | "all";
  setSelectedUserId: (userId: IUser["id"] | "all") => void;
  canWrite: boolean;
  openingHours: OpeningHours;
  defaultDuration: number;
  /** Congés et absences over the visible range. */
  closures?: Closure[];
}) {
  const [badgeVariant, setBadgeVariant] = useState<TBadgeVariant>("colored");
  const workingHours = useMemo(() => workingHoursOf(openingHours), [openingHours]);
  const visibleHours = useMemo(() => visibleHoursOf(workingHours), [workingHours]);

  const closuresOn = (day: Date) => closures.filter((c) => covers(c, dayKey(day)));
  const closureOn = (day: Date, practitionerId: string | null) => {
    const today = closuresOn(day);
    return today.find((c) => c.practitionerId === null) ?? (practitionerId ? today.find((c) => c.practitionerId === practitionerId) : undefined);
  };
  const scheduleFor = (practitionerId: string | null): TSchedule => ({
    hours: workingHours,
    closed: (day) => !!closureOn(day, practitionerId),
  });
  // A doctor's absence closes the grid when the agenda shows that doctor (or there is only one).
  const shown = selectedUserId !== "all" ? selectedUserId : users.length === 1 ? users[0].id : null;

  return (
    <CalendarContext.Provider
      value={{
        view,
        setView,
        selectedDate,
        setSelectedDate: (date) => date && setSelectedDate(date),
        selectedUserId,
        setSelectedUserId,
        badgeVariant,
        setBadgeVariant,
        users,
        visibleHours,
        openingHours,
        workingHours,
        schedule: scheduleFor(shown),
        scheduleFor,
        closureOn,
        closuresOn,
        defaultDuration,
        events,
        canWrite,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): ICalendarContext {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("useCalendar must be used within a CalendarProvider.");
  return context;
}
