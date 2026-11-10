// Types of team meetings (clinic-api src/meetings).

export type MeetingStatus = "upcoming" | "live" | "ended" | "cancelled";

export type MeetingPerson = { id: string; name: string; role: string };

export type Meeting = {
	id: string;
	title: string;
	startsAt: string;
	endsAt: string;
	meetUrl: string;
	cancelledAt: string | null;
	createdBy: { id: string; name: string } | null;
	participants: MeetingPerson[];
	status: MeetingStatus;
};

/** GET /meetings: coming and running, then the last three months. */
export type MeetingList = { upcoming: Meeting[]; past: Meeting[] };

/** GET /integrations/google */
export type GoogleStatus =
	| { configured: false; connected: false }
	| {
			configured: true;
			connected: boolean;
			email: string | null;
			connectedAt: string | null;
			connectedBy: string | null;
	  };

/** react-query keys: the live strip and the meetings page. */
export const CURRENT_MEETINGS_KEY = ["meetings", "current"] as const;
export const MEETINGS_KEY = ["meetings"] as const;

/** Durations offered when starting one, in minutes. */
export const MEETING_DURATIONS = [15, 30, 45, 60, 90] as const;
