import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatFileNumber, formatPhone } from "@/lib/patients";
import type { PrintedPrescription } from "@/lib/prescriptions";
import { apiGet } from "@/lib/server-api";
import { cn } from "@/lib/utils";
import { PrintButton } from "../../receipts/[id]/print-button";

/** Moroccan ordonnances are mostly A5; A4 for pre-printed or full-page paper. */
const FORMATS = {
	a5: { label: "A5", width: "w-[148mm]", height: "min-h-[210mm]", page: "A5", text: "text-[12.5px]" },
	a4: { label: "A4", width: "w-[210mm]", height: "min-h-[297mm]", page: "A4", text: "text-sm" },
} as const;
type Format = keyof typeof FORMATS;

export async function generateMetadata({ params }: PageProps<"/ordonnances/[id]">): Promise<Metadata> {
	const rx = await apiGet<PrintedPrescription>(`/prescriptions/visit/${(await params).id}/print`);
	return { title: `Ordonnance ${rx.patient.firstName} ${rx.patient.lastName}` };
}

/** "34 ans", or "18 mois" for a toddler, on the day of the visit. */
function ageAt(birthDate: string | null, date: string) {
	if (!birthDate) return null;
	const years = differenceInYears(new Date(date), parseISO(birthDate));
	if (years >= 2) return `${years} ans`;
	return `${differenceInMonths(new Date(date), parseISO(birthDate))} mois`;
}

/**
 * Ordonnance (print / save as PDF), on the cabinet's letterhead: the doctor,
 * the patient, one numbered line per medication, the advice, the signature.
 * Written in French, like every ordonnance in Morocco.
 */
export default async function PrescriptionPage({ params, searchParams }: PageProps<"/ordonnances/[id]">) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	const format: Format = query.format === "a4" ? "a4" : "a5";
	const f = FORMATS[format];
	const rx = await apiGet<PrintedPrescription>(`/prescriptions/visit/${id}/print`);
	const { cabinet, space, patient } = rx;
	const address = [space.address ?? cabinet.address, space.city ?? cabinet.city].filter(Boolean).join(", ");
	const phone = space.phone ?? cabinet.phone;
	const city = space.city ?? cabinet.city;
	const age = ageAt(patient.birthDate, rx.date);
	const adult = age !== null && !age.endsWith("mois") && Number.parseInt(age, 10) >= 18;
	const title = adult || age === null ? (patient.sex === "female" ? "Mme " : "M. ") : "";

	return (
		<div className="flex flex-col items-center gap-4 px-4 print:block print:px-0">
			{/* The paper size the browser prints on. */}
			<style>{`@page { size: ${f.page}; margin: 0; }`}</style>

			<div className={cn("flex max-w-full flex-wrap items-center justify-between gap-3 print:hidden", f.width)}>
				<div className="bg-muted inline-flex rounded-lg p-[3px] text-sm">
					{(Object.keys(FORMATS) as Format[]).map((key) => (
						<Link
							key={key}
							href={`?format=${key}`}
							replace
							className={cn(
								"rounded-md px-3 py-1 font-medium",
								key === format ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							{FORMATS[key].label}
						</Link>
					))}
				</div>
				<PrintButton />
			</div>

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
				<header className="border-primary flex items-start justify-between gap-6 border-b-2 pb-4">
					<div className="grid gap-0.5">
						<p className="text-primary text-lg leading-tight font-bold">{rx.practitioner}</p>
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
					{formatDate(rx.date)}
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
						{[age && `Âge : ${age}`, rx.weightKg && `Poids : ${rx.weightKg.toLocaleString("fr-MA")} kg`, formatFileNumber(patient.fileNumber)]
							.filter(Boolean)
							.join("  ·  ")}
					</p>
				</div>

				<h1 className="mt-6 mb-5 text-center text-base font-semibold tracking-[0.3em] uppercase">Ordonnance</h1>

				<ol className="grid gap-4">
					{rx.items.map((item, i) => (
						<li key={i} className="grid grid-cols-[1.5rem_1fr] break-inside-avoid">
							<span className="font-semibold tabular-nums">{i + 1}.</span>
							<div className="grid gap-0.5">
								<p className="font-semibold">{item.medication}</p>
								{item.posology && <p>{item.posology}</p>}
								{item.duration && <p className="text-zinc-600">Durée : {item.duration}</p>}
							</div>
						</li>
					))}
				</ol>

				{rx.notes && (
					<div className="mt-6 border-t border-dashed pt-3">
						<p className="mb-0.5 text-xs text-zinc-500">Conseils</p>
						<p className="whitespace-pre-line">{rx.notes}</p>
					</div>
				)}

				<footer className="mt-auto flex justify-end pt-8">
					<div className="grid h-24 w-52 place-items-end rounded-lg border border-dashed p-2 text-xs text-zinc-500">
						Cachet et signature
					</div>
				</footer>
			</article>
		</div>
	);
}
