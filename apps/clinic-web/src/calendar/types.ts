import type { MoroccoHoliday } from "@cabinova/morocco-time";

export type TCalendarView = "day" | "week" | "month" | "year" | "agenda";
export type TEventColor = "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "amber" | "brand" | "gray";
export type TBadgeVariant = "dot" | "colored" | "mixed";
/** Opening periods per day (Date.getDay()), in minutes since midnight; none = closed. */
export type TWorkingHours = { [day: number]: { from: number; to: number }[] };

/**
 * The opening hours, and the days closed whatever they say: the public
 * holidays the cabinet doesn't work, and congés.
 */
export type TSchedule = {
  hours: TWorkingHours;
  holiday: (day: Date) => MoroccoHoliday | undefined;
  closed: (day: Date) => boolean;
};
export type TVisibleHours = { from: number; to: number };
