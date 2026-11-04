import type { IconType } from "react-icons";
import { LuCircleDot, LuCoffee, LuGraduationCap, LuThermometer, LuTreePalm } from "react-icons/lu";

// Types and helpers of the Closures API (clinic-api/src/closures): Congés et absences.

/** react-query key prefix of every closures list (invalidate after a change). */
export const CLOSURES_KEY = ["closures"] as const;

export const CLOSURE_KINDS = ["vacation", "day_off", "training", "sick", "other"] as const;
export type ClosureKind = (typeof CLOSURE_KINDS)[number];

export const KIND_ICONS: Record<ClosureKind, IconType> = {
	vacation: LuTreePalm,
	day_off: LuCoffee,
	training: LuGraduationCap,
	sick: LuThermometer,
	other: LuCircleDot,
};

/** Whole days, both included ("YYYY-MM-DD"). No practitioner: the whole cabinet is closed. */
export type Closure = {
	id: string;
	kind: ClosureKind;
	practitionerId: string | null;
	practitionerName: string | null;
	startsOn: string;
	endsOn: string;
	note: string | null;
	createdAt: string;
	/** Appointments still booked in it, to move. */
	appointments: number;
};

/** GET /closures/conflicts: the appointments booked in a period. */
export type Conflict = {
	id: string;
	startsAt: string;
	status: string;
	patient: { id: string; firstName: string; lastName: string; phone: string | null };
	practitioner: { id: string; name: string };
};

/** "YYYY-MM-DD" of a day on the user's calendar. */
export const dayKey = (day: Date) =>
	`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

export const covers = (closure: Pick<Closure, "startsOn" | "endsOn">, day: string) =>
	closure.startsOn <= day && day <= closure.endsOn;

/** Number of days, both ends included. */
export const daysIn = (startsOn: string, endsOn: string) =>
	Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1;

/**
 * Who may record days for this person: the responsible doctor for anyone
 * (and the whole cabinet), the front desk for any doctor, a doctor for themself.
 */
export const canManage = (user: { id: string; role: string }, practitionerId: string | null) =>
	user.role === "owner" || (practitionerId !== null && (user.role === "secretary" || user.id === practitionerId));
