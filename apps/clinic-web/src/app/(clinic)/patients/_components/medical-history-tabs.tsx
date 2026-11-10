"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { IconPill, IconPrinter, IconSignature } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { type Certificate, certificatesKey, periodDays } from "@/lib/certificates";
import type { PastPrescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

// Doctors only (the API refuses anyone else). Same queries as the dossier,
// so both share the cache. Read-only here: writing and cancelling stay in
// the dossier, the sheet is for looking back and reprinting.

function Empty({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }) {
	return (
		<div className="flex flex-col items-center gap-2 py-12 text-center">
			<Icon className="text-muted-foreground size-6" />
			<p className="text-muted-foreground text-sm">{title}</p>
			{hint && <p className="text-muted-foreground max-w-sm text-xs">{hint}</p>}
		</div>
	);
}

function PrintLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener"
			className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
		>
			<IconPrinter className="size-3.5" /> {label}
		</a>
	);
}

/** The patient's ordonnances, newest first, each to reprint. */
export function PrescriptionsTab({ patientId }: { patientId: string }) {
	const t = useTranslations("dossier.prescriptions");
	const format = useFormat();
	const prescriptions = useQuery({
		queryKey: ["prescriptions", patientId],
		queryFn: () => api<PastPrescription[]>(`/prescriptions?patientId=${patientId}`),
	});

	if (prescriptions.isPending) return <Skeleton className="h-40 rounded-xl" />;
	// An ordonnance started but left empty isn't one.
	const written = (prescriptions.data ?? []).filter((r) => r.items.length > 0);
	if (written.length === 0) return <Empty icon={IconPill} title={t("empty")} hint={t("emptyHint")} />;

	return (
		<ul className="grid gap-3">
			{written.map((r) => (
				<li key={r.id} className="rounded-xl border">
					<div className="flex items-center gap-3 border-b px-4 py-2.5">
						<p className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
							{format.date(r.date, { weekday: "short", month: "short" })}
							{r.practitioner && <span className="text-muted-foreground font-normal"> · {r.practitioner}</span>}
						</p>
						<PrintLink href={`/ordonnances/${r.appointmentId}`} label={t("reprint")} />
					</div>
					<ol className="grid gap-1.5 px-4 py-3 text-sm">
						{r.items.map((item, i) => (
							<li key={i} className="flex gap-2">
								<span className="text-muted-foreground w-4 shrink-0 text-end tabular-nums">{i + 1}.</span>
								<span className="min-w-0">
									<span className="font-medium">{item.medication}</span>
									{(item.posology || item.duration) && (
										<span className="text-muted-foreground">
											{" — "}
											{[item.posology, item.duration].filter(Boolean).join(", ")}
										</span>
									)}
								</span>
							</li>
						))}
					</ol>
					{r.notes && <p className="text-muted-foreground border-t px-4 py-2 text-xs whitespace-pre-line">{r.notes}</p>}
				</li>
			))}
		</ul>
	);
}

/** The patient's certificates, newest first, cancelled ones struck through. */
export function CertificatesTab({ patientId }: { patientId: string }) {
	const t = useTranslations("dossier.certificate");
	const format = useFormat();
	const certificates = useQuery({
		queryKey: certificatesKey(patientId),
		queryFn: () => api<Certificate[]>(`/certificates?patientId=${patientId}`),
	});

	if (certificates.isPending) return <Skeleton className="h-28 rounded-xl" />;
	const list = certificates.data ?? [];
	if (list.length === 0) return <Empty icon={IconSignature} title={t("empty")} />;

	return (
		<ul className="divide-y rounded-xl border">
			{list.map((c) => (
				<li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
					<div className="min-w-0 flex-1">
						<p className={cn("text-sm font-medium", c.cancelledAt && "text-muted-foreground line-through")}>
							{c.kind === "period"
								? t("periodSummary", {
										days: periodDays(c.startsOn, c.endsOn ?? c.startsOn) ?? 1,
										from: format.date(c.startsOn),
										to: format.date(c.endsOn ?? c.startsOn),
									})
								: t("daySummary", { date: format.date(c.startsOn) })}
						</p>
						<p className="text-muted-foreground text-xs">
							{t("givenOn", { date: format.date(c.createdAt), by: c.practitioner ?? "—" })}
							{c.cancelledAt && ` · ${t("cancelledOn", { date: format.date(c.cancelledAt), by: c.cancelledBy ?? "—" })}`}
						</p>
					</div>
					{c.cancelledAt ? (
						<Badge variant="destructive">{t("cancelled")}</Badge>
					) : (
						<PrintLink href={`/certificats/${c.id}`} label={t("print")} />
					)}
				</li>
			))}
		</ul>
	);
}
