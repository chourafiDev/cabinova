import Link from "next/link";
import { LuCalendarPlus, LuUserPlus } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { ClinicSession } from "@/lib/session";

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
	return (
		<section className="mb-4 flex flex-col gap-5 rounded-2xl bg-brand px-8 dark:bg-brand/10 py-6 md:flex-row md:items-center md:gap-10 md:py-8">
			<div className="min-w-0 flex-1">
				<h1 className="mb-0.5 text-xl font-medium tracking-[0.015rem] text-white">
					Bonjour, <span className="font-semibold text-brand-light">{session.user.name}</span>
				</h1>
				<p className="text-sm text-white/80">
					{upcoming > 0
						? `${upcoming} rendez-vous encore prévus aujourd’hui au ${session.cabinet.name}.`
						: `Plus de rendez-vous prévus aujourd’hui au ${session.cabinet.name}.`}
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
						<Link href="/appointments">
							<LuCalendarPlus /> Nouveau rendez-vous
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
						<Link href="/patients">
							<LuUserPlus /> Nouveau patient
						</Link>
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-3 border-dashed border-white/30 md:border-l md:pl-10">
				<div className="flex size-12 items-center justify-center rounded-full border text-xl font-semibold text-white">
					{formatDate(day, { day: "numeric", month: undefined, year: undefined })}
				</div>
				<div>
					<p className="text-sm font-medium text-white capitalize">
						{formatDate(day, { weekday: "long", day: undefined, month: undefined, year: undefined })}
					</p>
					<p className="text-sm font-medium text-white capitalize">
						{formatDate(day, { day: undefined, month: "long", year: "numeric" })}
					</p>
				</div>
			</div>
		</section>
	);
}
