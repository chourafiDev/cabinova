import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconCalendarAdd, IconUserAdd } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NEW_PATIENT_HREF } from "@/lib/patients";
import type { ClinicSession } from "@/lib/session";
import { useFormat } from "@/lib/use-format";

/** Greeting, today's date and the two most frequent actions. */
export function WelcomeBanner({
	session,
	date,
	upcoming,
}: {
	session: ClinicSession;
	date: string;
	upcoming: number;
}) {
	const day = new Date(`${date}T12:00:00`);
	const t = useTranslations("dashboard.welcome");
	const format = useFormat();
	const cabinet = session.cabinet.name;
	return (
		<section className="mb-4 flex flex-col gap-5 rounded-2xl bg-brand px-8 dark:bg-brand/10 py-6 md:flex-row md:items-center md:gap-10 md:py-8">
			<div className="min-w-0 flex-1">
				<h1 className="mb-0.5 text-xl font-medium tracking-[0.015rem] text-white">
					{t("hello")} <span className="font-semibold text-brand-light">{session.user.name}</span>
				</h1>
				<p className="text-sm text-white/80">
					{upcoming > 0 ? t("upcoming", { count: upcoming, cabinet }) : t("none", { cabinet })}
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
						<Link href="/appointments?view=day">
							<IconCalendarAdd /> {t("newAppointment")}
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
						<Link href={NEW_PATIENT_HREF}>
							<IconUserAdd /> {t("newPatient")}
						</Link>
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-3 border-dashed border-white/30 md:border-s md:ps-10">
				<div className="flex size-12 items-center justify-center rounded-full border text-xl font-semibold text-white">
					{format.date(day, { day: "numeric", month: undefined, year: undefined })}
				</div>
				<div>
					<p className="text-sm font-medium text-white capitalize">
						{format.date(day, { weekday: "long", day: undefined, month: undefined, year: undefined })}
					</p>
					<p className="text-sm font-medium text-white capitalize">
						{format.date(day, { day: undefined, month: "long", year: "numeric" })}
					</p>
				</div>
			</div>
		</section>
	);
}
