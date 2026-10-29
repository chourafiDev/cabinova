export type TCalendarView = "day" | "week" | "month" | "year" | "agenda";
export type TEventColor = "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "gray";
export type TBadgeVariant = "dot" | "colored" | "mixed";
/** Opening periods per day (Date.getDay()), in minutes since midnight; none = closed. */
export type TWorkingHours = { [day: number]: { from: number; to: number }[] };
export type TVisibleHours = { from: number; to: number };
