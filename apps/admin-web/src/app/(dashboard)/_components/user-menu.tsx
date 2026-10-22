"use client";

import { ChevronDown, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { useCan, useSessionStore } from "@/stores/session-store";

function initials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]!.toUpperCase())
		.join("");
}

/** Avatar + name in the header, with the account menu. */
export function UserMenu() {
	const router = useRouter();
	const user = useSessionStore((s) => s.session?.user);
	const canSettings = useCan("settings:read");
	const canStaff = useCan("users:read");
	if (!user) return null;

	async function signOut() {
		await api("/auth/logout", { method: "POST" }).catch(() => {});
		useSessionStore.getState().setSession(null);
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
							{initials(user.name)}
						</AvatarFallback>
					</Avatar>
					<span className="hidden text-start leading-tight md:grid">
						<span className="max-w-36 truncate text-sm font-medium">{user.name}</span>
						<span className="text-muted-foreground max-w-36 truncate text-xs">{user.roles.map((r) => r.name).join(", ") || user.email}</span>
					</span>
					<ChevronDown className="text-muted-foreground size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-72 rounded-lg">
				<DropdownMenuLabel className="font-normal">
					<div className="grid text-sm leading-tight">
						<span className="truncate font-medium">{user.name}</span>
						<span className="text-muted-foreground truncate text-xs">{user.email}</span>
					</div>
				</DropdownMenuLabel>
				{(canSettings || canStaff) && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							{canSettings && (
								<DropdownMenuItem asChild>
									<Link href="/settings">
										<Settings />
										Réglages
									</Link>
								</DropdownMenuItem>
							)}
							{canStaff && (
								<DropdownMenuItem asChild>
									<Link href="/staff">
										<Users />
										Équipe
									</Link>
								</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
					</>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={signOut}>
					<LogOut />
					Se déconnecter
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
