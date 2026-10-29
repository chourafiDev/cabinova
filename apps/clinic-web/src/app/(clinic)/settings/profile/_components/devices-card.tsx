"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuLoader, LuLogOut, LuMonitor, LuSmartphone } from "react-icons/lu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { type DeviceSession, describeDevice } from "@/lib/settings";
import { SettingsCard } from "../../_components/settings-card";

/** Where this person is signed in; any other device can be signed out. */
export function DevicesCard({ sessions }: { sessions: DeviceSession[] }) {
	const router = useRouter();
	const [pending, setPending] = useState<string | null>(null);
	const others = sessions.filter((s) => !s.current).length;

	const revoke = async (id: string | "others") => {
		setPending(id);
		try {
			await api(id === "others" ? "/settings/sessions" : `/settings/sessions/${id}`, { method: "DELETE" });
			toast.success(id === "others" ? "Autres appareils déconnectés" : "Appareil déconnecté");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Déconnexion impossible");
		} finally {
			setPending(null);
		}
	};

	return (
		<SettingsCard
			title="Appareils connectés"
			description="Un appareil que vous ne reconnaissez pas ? Déconnectez-le, puis changez votre mot de passe."
			action={
				others > 0 && (
					<Button variant="outline" size="sm" disabled={pending !== null} onClick={() => revoke("others")}>
						{pending === "others" ? <LuLoader className="animate-spin" /> : <LuLogOut />} Déconnecter les autres
					</Button>
				)
			}
		>
			<ul className="divide-y rounded-lg border">
				{sessions.map((s) => {
					const device = describeDevice(s.userAgent);
					const Icon = device.mobile ? LuSmartphone : LuMonitor;
					return (
						<li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
							<span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
								<Icon className="size-4" />
							</span>
							<div className="grid min-w-0 flex-1 leading-tight">
								<span className="flex items-center gap-2 text-sm font-medium">
									{device.label}
									{s.current && (
										<Badge variant="outline" className="border-transparent bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-400">
											Cet appareil
										</Badge>
									)}
								</span>
								<span className="text-muted-foreground truncate text-xs">
									Connecté le {formatDate(s.createdAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
									{s.ip && ` · ${s.ip}`}
								</span>
							</div>
							{!s.current && (
								<Button
									variant="ghost"
									size="sm"
									className="text-muted-foreground hover:text-destructive"
									disabled={pending !== null}
									onClick={() => revoke(s.id)}
								>
									{pending === s.id ? <LuLoader className="animate-spin" /> : <LuLogOut />} Déconnecter
								</Button>
							)}
						</li>
					);
				})}
			</ul>
		</SettingsCard>
	);
}
