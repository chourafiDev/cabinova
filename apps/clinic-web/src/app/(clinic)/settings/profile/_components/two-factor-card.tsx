"use client";

import { useTranslations } from "next-intl";
import { LuKeyRound, LuLoader, LuShieldCheck, LuShieldOff, LuSmartphone } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RecoveryCodes, TwoFactorSetup } from "@/components/two-factor-setup";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { TwoFactorStatus } from "@/lib/settings";
import { useFormat } from "@/lib/use-format";
import { SettingsCard } from "../../_components/settings-card";

/** Asks for a code (app or backup) before a sensitive change. */
function CodeDialog({
	title,
	description,
	action,
	destructive,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	action: string;
	destructive?: boolean;
	onConfirm: (code: string) => Promise<void>;
	onClose: () => void;
}) {
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const t = useTranslations("settings.twoFactor");
	const common = useTranslations("settings.common");
	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<form
					className="grid gap-4"
					onSubmit={async (e) => {
						e.preventDefault();
						setPending(true);
						setError(null);
						try {
							await onConfirm(code);
						} catch (err) {
							setError(err instanceof Error ? err.message : t("invalid"));
							setPending(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<Field data-invalid={!!error}>
						<FieldLabel htmlFor="confirm-code">{t("code")}</FieldLabel>
						<Input id="confirm-code" autoFocus autoComplete="one-time-code" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
						<FieldError errors={error ? [{ message: error }] : []} />
					</Field>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{common("cancel")}
						</Button>
						<Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || code.trim().length < 6}>
							{pending && <LuLoader className="animate-spin" />} {action}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** Mon profil: turn two-factor sign-in on or off, and renew the backup codes. */
export function TwoFactorCard({ status }: { status: TwoFactorStatus }) {
	const router = useRouter();
	const [setup, setSetup] = useState(false);
	const [codes, setCodes] = useState<string[] | null>(null);
	const [dialog, setDialog] = useState<"disable" | "regenerate" | null>(null);
	const t = useTranslations("settings.twoFactor");
	const format = useFormat();

	const finish = () => {
		setSetup(false);
		setCodes(null);
		router.refresh();
	};

	return (
		<SettingsCard
			title={
				<span className="flex items-center gap-2">
					{t("title")}
					<Badge
						variant="outline"
						className={status.enabled ? "border-transparent bg-emerald-50 text-emerald-700" : "border-transparent bg-amber-50 text-amber-800"}
					>
						{status.enabled ? t("enabled") : t("disabled")}
					</Badge>
				</span>
			}
			description={t("description")}
		>
			{codes ? (
				<RecoveryCodes codes={codes} onDone={finish} />
			) : setup ? (
				<TwoFactorSetup onDone={finish} onCancel={() => setSetup(false)} />
			) : status.enabled ? (
				<div className="grid gap-4">
					<div className="flex items-start gap-3 text-sm">
						<LuShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
						<p>
							{t("protected")}
							{status.enabledAt && ` ${t("enabledOn", { date: format.date(status.enabledAt) })}`}
							{status.required && ` ${t("required")}`}
						</p>
					</div>
					<div className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
						<LuKeyRound className="text-muted-foreground size-4" />
						<span className="flex-1">
							{t("codesLeft", { count: status.recoveryCodesLeft })}
						</span>
						{status.recoveryCodesLeft <= 3 && <span className="text-xs text-amber-700">{t("renewHint")}</span>}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => setDialog("regenerate")}>
							<LuKeyRound /> {t("newCodes")}
						</Button>
						{!status.required && (
							<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("disable")}>
								<LuShieldOff /> {t("disable")}
							</Button>
						)}
					</div>
				</div>
			) : (
				<div className="grid gap-4">
					<div className="flex items-start gap-3 text-sm">
						<LuSmartphone className="text-muted-foreground mt-0.5 size-5 shrink-0" />
						<p>{t("recommended")}</p>
					</div>
					<div>
						<Button onClick={() => setSetup(true)}>
							<LuShieldCheck /> {t("enable")}
						</Button>
					</div>
				</div>
			)}

			{dialog === "disable" && (
				<CodeDialog
					title={t("disableTitle")}
					description={t("disableHint")}
					action={t("disable")}
					destructive
					onClose={() => setDialog(null)}
					onConfirm={async (c) => {
						await api("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: c }) });
						toast.success(t("disabledDone"));
						setDialog(null);
						router.refresh();
					}}
				/>
			)}
			{dialog === "regenerate" && (
				<CodeDialog
					title={t("newCodes")}
					description={t("newCodesHint")}
					action={t("generate")}
					onClose={() => setDialog(null)}
					onConfirm={async (c) => {
						const result = await api<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes", {
							method: "POST",
							body: JSON.stringify({ code: c }),
						});
						setDialog(null);
						setCodes(result.recoveryCodes);
					}}
				/>
			)}
		</SettingsCard>
	);
}
