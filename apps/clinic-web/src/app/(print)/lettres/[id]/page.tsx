import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import type { PrintedLetter } from "@/lib/letters";
import { formatFileNumber, formatPhone } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { cn } from "@/lib/utils";

/** A4 by default for a letter; A5 for cabinets that print everything small. */
const FORMATS = {
	a4: { label: "A4", width: "w-[210mm]", height: "min-h-[297mm]", page: "A4", text: "text-sm" },
	a5: { label: "A5", width: "w-[148mm]", height: "min-h-[210mm]", page: "A5", text: "text-[12.5px]" },
} as const;
type Format = keyof typeof FORMATS;

export async function generateMetadata({ params }: PageProps<"/lettres/[id]">): Promise<Metadata> {
	const r = await apiGet<PrintedLetter>(`/letters/${(await params).id}/print`);
	return { title: `${r.kind === "report" ? "Compte rendu" : "Lettre"} ${r.patient.firstName} ${r.patient.lastName}` };
}

/** "34 ans", or "18 mois" for a toddler, on the day of the letter. */
function ageAt(birthDate: string | null, date: string) {
	if (!birthDate) return null;
	const years = differenceInYears(new Date(date), parseISO(birthDate));
	if (years >= 2) return `${years} ans`;
	return `${differenceInMonths(new Date(date), parseISO(birthDate))} mois`;
}

/**
 * Lettre or compte rendu (print / save as PDF), on the cabinet's letterhead:
 * the doctor, the place and date, the patient, a title for a compte rendu,
 * the text as written (sanitized by the API), the signature.
 */
export default async function LetterPage({ params, searchParams }: PageProps<"/lettres/[id]">) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	const format: Format = query.format === "a5" ? "a5" : "a4";
	const f = FORMATS[format];
	const r = await apiGet<PrintedLetter>(`/letters/${id}/print`);
	const { cabinet, space, patient } = r;
	const address = [space.address ?? cabinet.address, space.city ?? cabinet.city].filter(Boolean).join(", ");
	const phone = space.phone ?? cabinet.phone;
	const city = space.city ?? cabinet.city;
	const age = ageAt(patient.birthDate, r.createdAt);
	const adult = age !== null && !age.endsWith("mois") && Number.parseInt(age, 10) >= 18;
	const title = adult || age === null ? (patient.sex === "female" ? "Mme " : "M. ") : "";

	return (
		<div className="flex flex-col items-center gap-4 px-4 print:block print:px-0">
			{/* The paper size the browser prints on. */}
			<style>{`@page { size: ${f.page}; margin: 0; }`}</style>

			{/* No toolbar: printed from the app's print dialog, which reads these for its A5 / A4 switch. */}
			<nav hidden>
				{(Object.keys(FORMATS) as Format[]).map((key) => (
					<a key={key} href={`?format=${key}`}>
						{FORMATS[key].label}
					</a>
				))}
			</nav>

			<article
				className={cn(
					"paper flex max-w-full flex-col bg-white p-[12mm] text-zinc-900 shadow-sm print:max-w-none print:shadow-none",
					f.width,
					f.height,
					f.text,
					// One sheet: a hair under the page, or the browser adds a blank one.
					format === "a5" ? "print:h-[209mm]" : "print:h-[296mm]",
				)}
			>
				<header className="border-primary flex items-start justify-between gap-6 border-b-2 pb-3">
					<div className="grid gap-0.5">
						<p className="text-primary text-base leading-tight font-bold">{r.practitioner}</p>
						{cabinet.specialty && <p className="font-medium">{cabinet.specialty}</p>}
						<p className="text-zinc-600">{cabinet.legalName ?? cabinet.name}</p>
					</div>
					<div className="grid gap-0.5 text-end text-xs text-zinc-600">
						{address && <p>{address}</p>}
						{phone && <p>Tél. {formatPhone(phone)}</p>}
						<p>{cabinet.email}</p>
					</div>
				</header>

				<p className="mt-5 text-end">
					{city ? `${city}, le ` : "Le "}
					{formatDate(r.createdAt)}
				</p>

				<div className="mt-4 grid gap-0.5">
					<p>
						<span className="text-zinc-500">Patient : </span>
						<strong>
							{title}
							{patient.firstName} {patient.lastName}
						</strong>
					</p>
					<p className="text-zinc-600">
						{[age && `Âge : ${age}`, formatFileNumber(patient.fileNumber)].filter(Boolean).join("  ·  ")}
					</p>
				</div>

				{r.kind === "report" ? (
					<h1 className="mt-6 mb-5 text-center text-base font-semibold tracking-[0.3em] uppercase">Compte rendu</h1>
				) : (
					<div className="mt-6" />
				)}

				{/* Sanitized by the API: the editor's formatting only, no scripts or links. */}
				<div
					className="leading-relaxed [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:ps-6"
					dangerouslySetInnerHTML={{ __html: r.body }}
				/>

				<footer className="mt-auto flex justify-end pt-6">
					<div className="grid h-24 w-48 place-items-end rounded-lg border border-dashed p-2 text-xs text-zinc-500">
						Cachet et signature
					</div>
				</footer>
			</article>
		</div>
	);
}
