"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuLoader, LuLogOut, LuMonitor, LuSmartphone } from "react-icons/lu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { describeDevice, type TeamSession } from "@/lib/settings";
import { SettingsCard } from "../../_components/settings-card";

/** Under this, the session counts as in use right now. */
const ONLINE_MS = 10 * 60_000;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function lastSeen(date: string, now: number) {
	return now - new Date(date).getTime() < ONLINE_MS
		? "Actif à l’instant"
		: `Actif ${formatDistanceToNowStrict(new Date(date), { locale: fr, addSuffix: true })}`;
}

/** Every signed-in device of the cabinet, person by person. */
export function TeamSessions({ sessions, ownId }: { sessions: TeamSession[]; ownId: string }) {
	const router = useRouter();
	const [pending, setPending] = useState<string | null>(null);
	const [now] = useState(() => Date.now());
	const people = [...Map.groupBy(sessions, (s) => s.member.id).values()];

	const run = async (key: string, action: () => Promise<unknown>, done: string) => {
		setPending(key);
		try {
			await action();
			toast.success(done);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Déconnexion impossible");
		} finally {
			setPending(null);
		}
	};

	return (
		<SettingsCard
			title="Sessions actives"
			description={`${plural(sessions.length, "appareil connecté")} · ${plural(people.length, "personne")}. Un accès qui vous semble anormal ? Déconnectez-le, puis faites changer le mot de passe.`}
		>
			<div className="grid gap-4">
				{people.map((devices) => {
					const { member } = devices[0];
					const own = member.id === ownId;
					return (
						<section key={member.id} className="grid gap-2">
							<header className="flex items-center justify-between gap-3">
								<h3 className="text-sm font-medium">
									{member.name}
									{own && <span className="text-muted-foreground font-normal"> (vous)</span>}
								</h3>
								{!own && (
									<Button
										variant="ghost"
										size="sm"
										className="text-muted-foreground hover:text-destructive h-7"
										disabled={pending !== null}
										onClick={() =>
											run(
												member.id,
												() => api(`/team/${member.id}/sessions/revoke`, { method: "POST" }),
												`${member.name} est déconnecté(e) partout`,
											)
										}
									>
										{pending === member.id ? <LuLoader className="animate-spin" /> : <LuLogOut />} Tout déconnecter
									</Button>
								)}
							</header>
							<ul className="divide-y rounded-lg border">
								{devices.map((s) => {
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
														<Badge variant="outline" className="border-transparent bg-emerald-50 font-normal text-emerald-700">
															Cet appareil
														</Badge>
													)}
												</span>
												<span className="text-muted-foreground truncate text-xs">
													{lastSeen(s.lastSeenAt, now)} · Connecté le{" "}
													{formatDate(s.createdAt, { month: "short", hour: "2-digit", minute: "2-digit" })}
													{s.ip && ` · ${s.ip}`}
												</span>
											</div>
											{!s.current && (
												<Button
													variant="ghost"
													size="sm"
													className="text-muted-foreground hover:text-destructive"
													disabled={pending !== null}
													onClick={() =>
														run(s.id, () => api(`/team/sessions/${s.id}`, { method: "DELETE" }), "Appareil déconnecté")
													}
												>
													{pending === s.id ? <LuLoader className="animate-spin" /> : <LuLogOut />} Déconnecter
												</Button>
											)}
										</li>
									);
								})}
							</ul>
						</section>
					);
				})}
			</div>
		</SettingsCard>
	);
}
