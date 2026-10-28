"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { initials } from "@/lib/format";
import type { ClinicSession } from "@/lib/session";

/** Avatar + name in the header, with the account menu. */
export function UserMenu({ user }: { user: ClinicSession["user"] }) {
	const router = useRouter();

	async function signOut() {
		await api("/auth/logout", { method: "POST" }).catch(() => {});
		router.replace("/login");
		router.refresh();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-muted data-[state=open]:bg-muted flex items-center gap-2 rounded-lg p-1 pe-2 transition-colors"
				>
					<Avatar className="size-8 rounded-lg">
						<AvatarFallback className="bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
							{initials(user.name.replace(/^dr\.?\s+/i, ""))}
						</AvatarFallback>
					</Avatar>
					<span className="hidden text-start leading-tight md:grid">
						<span className="max-w-36 truncate text-sm font-medium">{user.name}</span>
						<span className="text-muted-foreground max-w-36 truncate text-xs">{user.roleLabel}</span>
					</span>
					<ChevronDown className="text-muted-foreground size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-64 rounded-lg">
				<DropdownMenuLabel className="font-normal">
					<div className="grid text-sm leading-tight">
						<span className="truncate font-medium">{user.name}</span>
						<span className="text-muted-foreground truncate text-xs">{user.email}</span>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled>
					<UserRound />
					Mon profil
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={signOut}>
					<LogOut />
					Se déconnecter
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
