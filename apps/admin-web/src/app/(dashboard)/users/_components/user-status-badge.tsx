import { Badge } from "@/components/ui/badge";
import { type PlatformUserStatus, USER_STATUS_LABELS } from "@/lib/platform-users";
import { cn } from "@/lib/utils";

const TONES: Record<PlatformUserStatus, string> = {
	active: "bg-emerald-50 text-emerald-700",
	invited: "bg-sky-50 text-sky-700",
	disabled: "bg-zinc-100 text-zinc-600",
};

export function UserStatusBadge({ status, inviteExpired }: { status: PlatformUserStatus; inviteExpired?: boolean }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", TONES[status])}>
			{USER_STATUS_LABELS[status]}
			{status === "invited" && inviteExpired && " · lien expiré"}
		</Badge>
	);
}

/** Whether the account has two-factor authentication on. */
export function TwoFactorBadge({ enabled }: { enabled: boolean }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", enabled ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800")}>
			{enabled ? "2FA" : "Sans 2FA"}
		</Badge>
	);
}
