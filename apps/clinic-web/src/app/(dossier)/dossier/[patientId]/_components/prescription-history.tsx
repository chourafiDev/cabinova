"use client";

import { useTranslations } from "next-intl";
import { IconPill, IconPrinter } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { PastPrescription } from "@/lib/prescriptions";
import { useFormat } from "@/lib/use-format";

/** Ordonnance outside a visit: the patient's ordonnances, newest first, each to reprint. */
export function PrescriptionHistory({ prescriptions }: { prescriptions: PastPrescription[] | undefined }) {
	const t = useTranslations("dossier.prescriptions");
	const format = useFormat();

	if (!prescriptions) return <Skeleton className="h-40 rounded-xl" />;
	// An ordonnance started but left empty isn't one.
	const written = prescriptions.filter((r) => r.items.length > 0);
	if (written.length === 0) {
		return (
			<div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
				<IconPill className="text-muted-foreground size-6" />
				<p className="font-medium">{t("empty")}</p>
				<p className="text-muted-foreground max-w-sm text-sm">{t("emptyHint")}</p>
			</div>
		);
	}

	return (
		<section className="bg-card grid gap-4 rounded-xl border p-5" aria-label={t("title")}>
			<h2 className="flex items-center gap-2 font-semibold">
				<IconPill className="text-muted-foreground size-4" /> {t("title")}
				<span className="text-muted-foreground text-sm font-normal">{written.length}</span>
			</h2>
			<ul className="grid gap-3">
				{written.map((r) => (
					<li key={r.id} className="rounded-lg border">
						<div className="flex items-center gap-3 border-b px-3 py-2">
							<p className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
								{format.date(r.date, { weekday: "short", month: "short" })}
								{r.practitioner && <span className="text-muted-foreground font-normal"> · {r.practitioner}</span>}
							</p>
							<a
								href={`/ordonnances/${r.appointmentId}`}
								target="_blank"
								rel="noopener"
								className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
							>
								<IconPrinter className="size-3.5" /> {t("reprint")}
							</a>
						</div>
						<ol className="grid gap-1.5 p-3 text-sm">
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
						{r.notes && <p className="text-muted-foreground border-t px-3 py-2 text-xs whitespace-pre-line">{r.notes}</p>}
					</li>
				))}
			</ul>
		</section>
	);
}
