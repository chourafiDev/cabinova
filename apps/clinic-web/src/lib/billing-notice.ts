import type { ClinicSession } from "./session";

const DAY = 86_400_000;
/** From this many days left, the trial banner turns amber. */
const URGENT_DAYS = 3;

export type BillingNotice =
	| { kind: "trial"; tone: "info" | "warning"; daysLeft: number; endsAt: string; quotePending: boolean }
	| { kind: "trial-last-day"; tone: "warning"; endsAt: string; quotePending: boolean }
	| { kind: "trial-ended"; tone: "warning"; endsAt: string; quotePending: boolean }
	| { kind: "quote-due"; tone: "danger" }
	| { kind: "past-due"; tone: "danger" };

/**
 * The banner the responsible doctor sees about their subscription, or null:
 * the trial countdown, then the unpaid devis or invoice. Staff never see billing.
 */
export function billingNotice(session: ClinicSession, now: Date): BillingNotice | null {
	if (session.user.role !== "owner") return null;
	const { status, trialEndsAt, quotePending } = session.subscription;
	if (status === "past_due") return { kind: quotePending ? "quote-due" : "past-due", tone: "danger" };
	if (status !== "trialing" || !trialEndsAt) return null;

	const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / DAY);
	// The hourly billing check hasn't sent the devis yet.
	if (daysLeft <= 0) return { kind: "trial-ended", tone: "warning", endsAt: trialEndsAt, quotePending };
	if (daysLeft === 1) return { kind: "trial-last-day", tone: "warning", endsAt: trialEndsAt, quotePending };
	return { kind: "trial", tone: daysLeft <= URGENT_DAYS ? "warning" : "info", daysLeft, endsAt: trialEndsAt, quotePending };
}
