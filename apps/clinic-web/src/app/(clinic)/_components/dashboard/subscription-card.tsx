import { useTranslations } from "next-intl";
import { IconSparkles } from "@/components/icons";
import type { ClinicSession } from "@/lib/session";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SubscriptionButton } from "../billing/subscription-button";
import { ChartCard } from "./chart-card";

/** `warn`: turns red near the limit (storage); seats at their max are normal. */
function Usage({
	label,
	used,
	max,
	unit,
	warn,
}: {
	label: string;
	used: number;
	max: number | null;
	unit?: string;
	warn?: boolean;
}) {
	const ratio = max ? Math.min(used / max, 1) : 0;
	const t = useTranslations("dashboard.subscription");
	const format = useFormat();
	return (
		<div>
			<div className="mb-1 flex items-baseline justify-between text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{format.number(used)}
					{unit} / {max === null ? t("unlimited") : `${format.number(max)}${unit ?? ""}`}
				</span>
			</div>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-muted"
				role="meter"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={max ?? undefined}
				aria-valuenow={used}
			>
				<div
					className={cn("h-full rounded-full bg-primary", warn && ratio >= 0.9 && "bg-destructive")}
					style={{ width: `${ratio * 100}%` }}
				/>
			</div>
		</div>
	);
}

/** The cabinet's offer, as set by the platform: trial end and limits. */
export function SubscriptionCard({
	subscription: s,
	canManage,
}: {
	subscription: ClinicSession["subscription"];
	/** The responsible doctor: staff don't see the cabinet's billing. */
	canManage: boolean;
}) {
	const gb = (mb: number) => Math.round((mb / 1024) * 10) / 10;
	const t = useTranslations("dashboard.subscription");
	const format = useFormat();

	return (
		<ChartCard eyebrow={t("eyebrow")} title={s.plan ? t("offer", { plan: s.plan }) : t("noOffer")} className="h-full">
			<div className="grid gap-4">
				<p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
					<IconSparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
					<span>
						<span className="font-medium">{s.status ? t(s.status) : t("noSubscription")}</span>
						{s.status === "trialing" && s.trialEndsAt && (
							<> {t("until", { date: format.date(s.trialEndsAt) })} {t("chooseHint")}</>
						)}
						{s.status === "active" && s.currentPeriodEnd && (
							<>
								{" "}
								{s.currentPeriodStart
									? t("period", { from: format.date(s.currentPeriodStart), to: format.date(s.currentPeriodEnd) })
									: t("until", { date: format.date(s.currentPeriodEnd) })}
							</>
						)}
					</span>
				</p>
				<Usage label={t("doctors")} used={s.doctors.used} max={s.doctors.max} />
				<Usage label={t("secretaries")} used={s.secretaries.used} max={s.secretaries.max} />
				<Usage
					label={t("storage")}
					used={gb(s.storage.usedMb ?? 0)}
					max={s.storage.quotaMb === null ? null : gb(s.storage.quotaMb)}
					unit={` ${t("gb")}`}
					warn
				/>
				{canManage && <SubscriptionButton quotePending={s.quotePending} trialing={s.status === "trialing"} />}
			</div>
		</ChartCard>
	);
}
