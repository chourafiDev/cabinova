import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY } from "@/lib/appointments";

/**
 * Today's appointments, refreshed often: other desks check patients in too.
 * Same key shape as the agenda's day view, so a status change shows on both.
 */
export function useToday() {
	const from = startOfDay(new Date());
	const to = addDays(from, 1);
	return useQuery({
		queryKey: [...APPOINTMENTS_KEY, from.toISOString(), to.toISOString()],
		queryFn: () =>
			api<Appointment[]>(`/appointments?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`),
		refetchInterval: 30_000,
	});
}

/** Patients checked in and not yet called, in arrival order. */
export function useWaiting() {
	const query = useToday();
	const waiting = (query.data ?? [])
		.filter((a) => a.status === "arrived")
		.sort((a, b) => (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? ""));
	return { ...query, waiting };
}
