import { LuSparkles } from "react-icons/lu";
import { formatDate } from "@/lib/format";
import type { ClinicSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SubscriptionButton } from "../billing/subscription-button";
import { ChartCard } from "./chart-card";

const STATUS = {
	trialing: "Essai gratuit",
	active: "Abonnement actif",
	past_due: "En attente de paiement",
	cancelled: "Abonnement résilié",
} as const;

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
	return (
		<div>
			<div className="mb-1 flex items-baseline justify-between text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{used.toLocaleString("fr-MA")}
					{unit} / {max === null ? "illimité" : `${max.toLocaleString("fr-MA")}${unit ?? ""}`}
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

	return (
		<ChartCard eyebrow="Mon abonnement" title={s.plan ? `Offre ${s.plan}` : "Aucune offre"} className="h-full">
			<div className="grid gap-4">
				<p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
					<LuSparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
					<span>
						<span className="font-medium">{s.status ? STATUS[s.status] : "Pas d’abonnement en cours"}</span>
						{s.status === "trialing" && s.trialEndsAt && (
							<> jusqu’au {formatDate(s.trialEndsAt)}. Choisissez votre offre pour recevoir votre devis.</>
						)}
						{s.status === "active" && s.currentPeriodEnd && <> jusqu’au {formatDate(s.currentPeriodEnd)}.</>}
					</span>
				</p>
				<Usage label="Médecins" used={s.doctors.used} max={s.doctors.max} />
				<Usage label="Secrétaires" used={s.secretaries.used} max={s.secretaries.max} />
				<Usage
					label="Stockage"
					used={gb(s.storage.usedMb ?? 0)}
					max={s.storage.quotaMb === null ? null : gb(s.storage.quotaMb)}
					unit=" Go"
					warn
				/>
				{canManage && <SubscriptionButton quotePending={s.quotePending} trialing={s.status === "trialing"} />}
			</div>
		</ChartCard>
	);
}
