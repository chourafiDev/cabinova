// French formatting and Monday-first weeks for the vendored big-calendar views.
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/** date-fns week options: weeks start on Monday (Morocco). */
export const WEEK = { weekStartsOn: 1 } as const;

/** date-fns `format` in French. */
export const fmt = (date: Date | number, pattern: string) => format(date, pattern, { locale: fr });

/** Day index in a Monday-first week: lundi = 0 … dimanche = 6. */
export const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const WEEK_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const WEEK_DAYS_LETTER = ["L", "M", "M", "J", "V", "S", "D"];
