// Sample figures for the dashboard until the agenda, patients and payments
// exist in the clinic API. Typed like the future API responses: wiring them
// means replacing these bodies, not the pages. The user, the cabinet and its
// offer are real already (lib/session.ts).

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "in_consultation"
  | "done"
  | "no_show"
  | "cancelled";

export type Appointment = {
  id: string;
  /** Local time, "HH:mm". */
  time: string;
  durationMin: number;
  patient: { id: string; name: string; age: number; sex: "F" | "M"; isNew: boolean };
  reason: string;
  status: AppointmentStatus;
  /** "HH:mm" the patient checked in (arrived / in consultation / done). */
  arrivedAt?: string;
};

export type DashboardData = {
  date: string;
  kpis: {
    appointmentsToday: number;
    upcomingToday: number;
    seenToday: number;
    /** % vs the same weekday last week; null = nothing to compare. */
    seenChange: number | null;
    newPatientsMonth: number;
    newPatientsChange: number | null;
    collectedToday: number;
    collectedChange: number | null;
  };
  appointments: Appointment[];
  /** Monday → Saturday of the current week. */
  week: { date: string; appointments: number; consultations: number }[];
};

const p = (id: number, name: string, age: number, sex: "F" | "M", isNew = false) => ({
  id: `p${id}`,
  name,
  age,
  sex,
  isNew,
});

const APPOINTMENTS: Appointment[] = [
  { id: "a1", time: "08:30", durationMin: 20, patient: p(1, "Fatima Zahra El Idrissi", 34, "F"), reason: "Contrôle tension", status: "done", arrivedAt: "08:24" },
  { id: "a2", time: "09:00", durationMin: 30, patient: p(2, "Mohamed Amrani", 58, "M"), reason: "Suivi diabète", status: "done", arrivedAt: "08:52" },
  { id: "a3", time: "09:30", durationMin: 20, patient: p(3, "Salma Bennani", 27, "F", true), reason: "Certificat médical", status: "no_show" },
  { id: "a4", time: "10:00", durationMin: 30, patient: p(4, "Karim Tazi", 45, "M"), reason: "Douleurs lombaires", status: "done", arrivedAt: "09:55" },
  { id: "a5", time: "10:30", durationMin: 20, patient: p(5, "Nadia Chraibi", 62, "F"), reason: "Renouvellement d’ordonnance", status: "done", arrivedAt: "10:21" },
  { id: "a6", time: "11:00", durationMin: 30, patient: p(6, "Omar Alaoui", 8, "M"), reason: "Fièvre depuis 2 jours", status: "in_consultation", arrivedAt: "10:48" },
  { id: "a7", time: "11:30", durationMin: 20, patient: p(7, "Hajar Mansouri", 31, "F"), reason: "Résultats du bilan sanguin", status: "arrived", arrivedAt: "11:12" },
  { id: "a8", time: "12:00", durationMin: 30, patient: p(8, "Youssef Berrada", 39, "M", true), reason: "Première consultation", status: "arrived", arrivedAt: "11:40" },
  { id: "a9", time: "14:30", durationMin: 30, patient: p(9, "Imane Fassi", 52, "F"), reason: "Suivi thyroïde", status: "confirmed" },
  { id: "a10", time: "15:00", durationMin: 30, patient: p(10, "Rachid Ouazzani", 67, "M"), reason: "Contrôle post-opératoire", status: "confirmed" },
  { id: "a11", time: "15:30", durationMin: 20, patient: p(11, "Leila Benjelloun", 29, "F", true), reason: "Consultation", status: "scheduled" },
  { id: "a12", time: "16:00", durationMin: 15, patient: p(12, "Anas Kettani", 23, "M"), reason: "Vaccination", status: "scheduled" },
];

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
/** "2026-10-27", in Moroccan time. */
const isoDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(date);

export function getDashboard(today: Date): DashboardData {
  // Monday of the current week (getDay: 0 = Sunday).
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  // [appointments, consultations] per day, Monday → Saturday.
  const perDay = [
    [14, 12],
    [11, 10],
    [12, 11],
    [13, 12],
    [10, 9],
    [6, 5],
  ];
  const todayIndex = (today.getDay() + 6) % 7;
  const seen = APPOINTMENTS.filter((a) => a.status === "done").length;

  return {
    date: isoDay(today),
    kpis: {
      appointmentsToday: APPOINTMENTS.filter((a) => a.status !== "cancelled").length,
      upcomingToday: APPOINTMENTS.filter((a) =>
        ["scheduled", "confirmed", "arrived", "in_consultation"].includes(a.status),
      ).length,
      seenToday: seen,
      seenChange: 33,
      newPatientsMonth: 18,
      newPatientsChange: 12,
      collectedToday: 120_000,
      collectedChange: -8,
    },
    appointments: APPOINTMENTS,
    week: perDay.map(([appointments, consultations], i) => ({
      date: isoDay(addDays(monday, i)),
      appointments: i === todayIndex ? APPOINTMENTS.length : appointments,
      // Today: the consultations done so far; later days: none yet.
      consultations: i < todayIndex ? consultations : i === todayIndex ? seen : 0,
    })),
  };
}
