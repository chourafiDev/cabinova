export type TCalendarView = "day" | "week" | "month" | "year" | "agenda";
export type TEventColor = "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "gray";
export type TBadgeVariant = "dot" | "colored" | "mixed";
/** Opening periods per day (Date.getDay()), in minutes since midnight; none = closed. */
export type TWorkingHours = { [day: number]: { from: number; to: number }[] };

/** The opening hours, and the days closed whatever they say (public holidays, congés). */
export type TSchedule = { hours: TWorkingHours; closed: (day: Date) => boolean };
export type TVisibleHours = { from: number; to: number };
