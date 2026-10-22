"use client";

import { createContext, useContext, useState } from "react";

import type { Dispatch, SetStateAction } from "react";
import type { IEvent, IUser } from "@/calendar/interfaces";
import type { TBadgeVariant, TCalendarView, TVisibleHours, TWorkingHours } from "@/calendar/types";

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
  workingHours: TWorkingHours;
  setWorkingHours: Dispatch<SetStateAction<TWorkingHours>>;
  visibleHours: TVisibleHours;
  setVisibleHours: Dispatch<SetStateAction<TVisibleHours>>;
  events: IEvent[];
  /** appointments:write — booking, drag & drop, status changes. */
  canWrite: boolean;
}

const CalendarContext = createContext<ICalendarContext | null>(null);

// TODO(settings): per-clinic opening hours from Réglages. Keys are Date.getDay() (0 = dimanche).
const WORKING_HOURS: TWorkingHours = {
  0: { from: 0, to: 0 },
  1: { from: 8, to: 18 },
  2: { from: 8, to: 18 },
  3: { from: 8, to: 18 },
  4: { from: 8, to: 18 },
  5: { from: 8, to: 18 },
  6: { from: 8, to: 13 },
};

const VISIBLE_HOURS: TVisibleHours = { from: 8, to: 19 };

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
}) {
  const [badgeVariant, setBadgeVariant] = useState<TBadgeVariant>("colored");
  const [visibleHours, setVisibleHours] = useState<TVisibleHours>(VISIBLE_HOURS);
  const [workingHours, setWorkingHours] = useState<TWorkingHours>(WORKING_HOURS);

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
        setVisibleHours,
        workingHours,
        setWorkingHours,
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
