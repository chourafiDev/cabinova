"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { IconPrinter, IconReceipt, IconWallet } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { PatientAccount } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * Prix consultation outside a visit: every visit's acts, what was paid and
 * how, and each payment's reçu to print. Read-only: the desk collects.
 */
export function PaymentHistory({ patientId }: { patientId: string }) {
	const t = useTranslations("dossier.payments");
	const account = useTranslations("patients.account");
	const methods = useTranslations("payments.methods");
	const format = useFormat();
	const { data, isError } = useQuery({
		queryKey: ["patient-account", patientId],
		queryFn: () => api<PatientAccount>(`/patients/${patientId}/account`),
	});

	if (isError) return <p className="text-destructive text-sm">{t("loadError")}</p>;
	if (!data) return <Skeleton className="h-40 rounded-xl" />;
	if (data.visits.length === 0) {
		return (
			<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
				<IconWallet className="text-muted-foreground size-6" />
				<p className="font-medium">{t("empty")}</p>
				<p className="text-muted-foreground max-w-sm text-sm">{t("emptyHint")}</p>
			</div>
		);
	}

	return (
		<section className="bg-card grid gap-4 rounded-xl border p-5" aria-label={t("title")}>
			<header className="flex flex-wrap items-baseline justify-between gap-3">
				<h2 className="flex items-center gap-2 font-semibold">
					<IconReceipt className="text-muted-foreground size-4" /> {t("title")}
				</h2>
				<p className="text-muted-foreground text-sm">
					{account("dueTitle")}{" "}
					<span className={cn("font-semibold tabular-nums", data.balance > 0 ? "text-amber-700" : "text-foreground")}>
						{format.mad(data.balance)}
					</span>
				</p>
			</header>
			<ul className="grid gap-3">
				{data.visits.map((v) => (
					<li key={v.appointmentId} className="rounded-lg border">
						<div className="flex items-start gap-3 p-3">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium first-letter:uppercase">
									{format.date(v.startsAt, { weekday: "short", month: "short" })} · {v.practitioner}
								</p>
								<p className="text-muted-foreground text-xs">{v.acts.join(", ")}</p>
							</div>
							<div className="text-end text-sm tabular-nums">
								<p className="font-medium">
									{v.discount > 0 && (
										<span className="text-muted-foreground me-1.5 text-xs font-normal line-through">
											{format.mad(v.subtotal)}
										</span>
									)}
									{format.mad(v.total)}
								</p>
								{v.discount > 0 && (
									<p className="text-xs text-emerald-700">{account("discount", { amount: format.mad(v.discount) })}</p>
								)}
								<p className={cn("text-xs", v.balance > 0 ? "text-amber-700" : "text-muted-foreground")}>
									{v.balance > 0
										? account("remaining", { amount: format.mad(v.balance) })
										: v.balance < 0
											? account("overpaid", { amount: format.mad(-v.balance) })
											: account("settled")}
								</p>
							</div>
						</div>
						{v.payments.length > 0 ? (
							<ul className="bg-muted/40 divide-y border-t text-sm">
								{v.payments.map((p) => (
									<li key={p.id} className="flex items-center gap-3 px-3 py-2">
										<span className={cn("font-medium tabular-nums", p.kind === "refund" && "text-destructive")}>
											{p.kind === "refund" ? `− ${format.mad(p.amount)}` : format.mad(p.amount)}
										</span>
										<span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
											{methods(p.method)} · {format.date(p.receivedAt, { month: "short" })}
											{p.receiptNumber && ` · ${p.receiptNumber}`}
										</span>
										{p.kind === "payment" && (
											<a
												href={`/receipts/${p.id}`}
												target="_blank"
												rel="noopener"
												className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
											>
												<IconPrinter className="size-3.5" /> {t("receipt")}
											</a>
										)}
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground bg-muted/40 border-t px-3 py-2 text-xs">{t("nothingPaid")}</p>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
