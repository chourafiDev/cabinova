/** The `timeZone` to give Intl for this moment in Morocco. */
export function moroccoZone(date: Date | string | number): string;

/** "YYYY-MM-DD" in Morocco, today by default. */
export function moroccoDay(date?: Date | string | number): string;

export type MoroccoHoliday = {
  /** "YYYY-MM-DD" */
  date: string;
  /** e.g. "throneDay", "eidAlFitr": the apps word it. */
  key:
    | 'newYear'
    | 'independenceManifesto'
    | 'amazighNewYear'
    | 'labourDay'
    | 'throneDay'
    | 'ouedEdDahab'
    | 'revolutionDay'
    | 'youthDay'
    | 'unityDay'
    | 'greenMarch'
    | 'independenceDay'
    | 'islamicNewYear'
    | 'mawlid'
    | 'eidAlFitr'
    | 'eidAlAdha';
  /** Religious holiday: computed, confirmed by moon sighting (± 1 day). */
  estimated: boolean;
};

/** Morocco's public holidays of a year, by date. */
export function moroccoHolidays(year: number): MoroccoHoliday[];

/** The public holiday on this day ("YYYY-MM-DD"), if any. */
export function moroccoHolidayOn(day: string): MoroccoHoliday | undefined;
