"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IconCalendarCheck, IconCheckCircle, IconSpinner, IconUnplug, IconVideo } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import type { GoogleStatus } from "@/lib/meetings";
import { useFormat } from "@/lib/use-format";
import { SettingsCard } from "../../_components/settings-card";

/** Google, for team meetings: connect once, then every meeting is a Meet link. */
export function GoogleCard({
	status,
	outcome,
}: {
	status: GoogleStatus;
	outcome: "connected" | "denied" | "scope" | "error" | null;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const t = useTranslations("settings.integrations");
	const format = useFormat();
	const [pending, setPending] = useState<"connect" | "disconnect" | null>(null);
	const [confirm, setConfirm] = useState(false);
	const shown = useRef(false);

	// Back from Google: say how it went once, then clean the address.
	useEffect(() => {
		if (!outcome || shown.current) return;
		shown.current = true;
		if (outcome === "connected") toast.success(t("outcome.connected"));
		else toast.error(t(`outcome.${outcome}`));
		router.replace(pathname);
	}, [outcome, pathname, router, t]);

	const connect = async () => {
		setPending("connect");
		try {
			const { url } = await api<{ url: string }>("/integrations/google/connect", { method: "POST" });
			window.location.assign(url);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("connectError"));
			setPending(null);
		}
	};

	const disconnect = async () => {
		setPending("disconnect");
		try {
			await api("/integrations/google", { method: "DELETE" });
			toast.success(t("disconnected"));
			setConfirm(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("disconnectError"));
		} finally {
			setPending(null);
		}
	};

	const connected = status.configured && status.connected;

	return (
		<>
			<SettingsCard
				title={
					<span className="flex items-center gap-2">
						<GoogleMark />
						{t("google.title")}
						{connected && (
							<Badge variant="secondary" className="gap-1 font-normal">
								<IconCheckCircle className="text-emerald-600 dark:text-emerald-400" />
								{t("google.connected")}
							</Badge>
						)}
					</span>
				}
				description={t("google.description")}
				footer={
					!status.configured ? (
						<p className="text-muted-foreground text-sm">{t("google.notConfigured")}</p>
					) : connected ? (
						<>
							<p className="text-muted-foreground text-sm">{t("google.privacy")}</p>
							<Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)}>
								<IconUnplug /> {t("google.disconnect")}
							</Button>
						</>
					) : (
						<>
							<p className="text-muted-foreground text-sm">{t("google.privacy")}</p>
							<Button type="button" onClick={connect} disabled={pending === "connect"}>
								{pending === "connect" ? <IconSpinner className="animate-spin" /> : <GoogleMark />}
								{t("google.connect")}
							</Button>
						</>
					)
				}
			>
				{connected ? (
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground">{t("google.account")}</dt>
							<dd className="font-medium break-all" dir="ltr">
								{status.email}
							</dd>
						</div>
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground">{t("google.since")}</dt>
							<dd>
								{status.connectedAt && format.date(status.connectedAt)}
								{status.connectedBy && ` · ${status.connectedBy}`}
							</dd>
						</div>
					</dl>
				) : (
					<ul className="grid gap-2.5 text-sm">
						{(["meet", "calendar", "team"] as const).map((key) => {
							const Icon = key === "meet" ? IconVideo : key === "calendar" ? IconCalendarCheck : IconCheckCircle;
							return (
								<li key={key} className="flex items-start gap-2.5">
									<Icon className="text-primary mt-0.5 size-4 shrink-0" />
									<span>{t(`google.benefits.${key}`)}</span>
								</li>
							);
						})}
					</ul>
				)}
			</SettingsCard>

			<Dialog open={confirm} onOpenChange={setConfirm}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("google.disconnectTitle")}</DialogTitle>
						<DialogDescription>{t("google.disconnectHint")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setConfirm(false)}>
							{t("cancel")}
						</Button>
						<Button type="button" variant="destructive" onClick={disconnect} disabled={pending === "disconnect"}>
							{pending === "disconnect" && <IconSpinner className="animate-spin" />}
							{t("google.disconnect")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

/** Google's "G", in its colours (a brand mark, not an icon of the app). */
export function GoogleMark({ className = "size-4" }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
			<path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
			<path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
			<path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
			<path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
		</svg>
	);
}
