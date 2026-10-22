import { Badge } from "@/components/ui/badge";
import type { Member } from "@/lib/team";
import { cn } from "@/lib/utils";

export function MemberStatus({ member }: { member: Pick<Member, "active" | "hasPassword"> }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"border-transparent",
				!member.active
					? "bg-zinc-100 text-zinc-500"
					: !member.hasPassword
						? "bg-amber-50 text-amber-700"
						: "bg-emerald-50 text-emerald-700",
			)}
		>
			{!member.active ? "Désactivé" : !member.hasPassword ? "Invitation en attente" : "Actif"}
		</Badge>
	);
}
