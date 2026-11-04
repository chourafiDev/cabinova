import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { api } from "@/lib/api-client";
import { type Appointment, APPOINTMENTS_KEY } from "@/lib/appointments";

/**
 * Today's appointments, cancelled ones too (who left the waiting room),
 * refreshed often: other desks check patients in too. Under the agenda's
 * key, so a status change shows on both.
 */
export function useToday() {
	const from = startOfDay(new Date());
	const to = addDays(from, 1);
	const range = { from: from.toISOString(), to: to.toISOString() };
	return useQuery({
		queryKey: [...APPOINTMENTS_KEY, range.from, range.to, "with-cancelled"],
		queryFn: () => api<Appointment[]>(`/appointments?${new URLSearchParams({ ...range, includeCancelled: "true" })}`),
		refetchInterval: 30_000,
	});
}

const byArrival = (a: Appointment, b: Appointment) => (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? "");

/** The waiting room today: who waits (arrival order), who is with a doctor, who left unseen. */
export function useWaiting() {
	const query = useToday();
	const today = query.data ?? [];
	return {
		...query,
		waiting: today.filter((a) => a.status === "arrived").sort(byArrival),
		inConsultation: today.filter((a) => a.status === "in_consultation").sort(byArrival),
		left: today
			.filter((a) => a.status === "cancelled" && a.leftAt)
			.sort((a, b) => (b.leftAt ?? "").localeCompare(a.leftAt ?? "")),
	};
}
