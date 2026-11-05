import type { Metadata } from "next";
import Link from "next/link";
import type { PrintedCertificate } from "@/lib/certificates";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { cn } from "@/lib/utils";
import { PrintButton } from "../../receipts/[id]/print-button";

/** A4 by default for a certificate; A5 for cabinets that print everything small. */
const FORMATS = {
	a4: { label: "A4", width: "w-[210mm]", height: "min-h-[297mm]", page: "A4", text: "text-[15px]" },
	a5: { label: "A5", width: "w-[148mm]", height: "min-h-[210mm]", page: "A5", text: "text-[13px]" },
} as const;
type Format = keyof typeof FORMATS;

export async function generateMetadata({ params }: PageProps<"/certificats/[id]">): Promise<Metadata> {
	const c = await apiGet<PrintedCertificate>(`/certificates/${(await params).id}/print`);
	return { title: `Certificat ${c.patient.firstName} ${c.patient.lastName}` };
}

/**
 * Certificat médical (print / save as PDF), on the cabinet's letterhead: the
 * doctor, the text as written (sanitized by the API), the place and date,
 * the signature. A cancelled certificate is refused by the API.
 */
export default async function CertificatePage({ params, searchParams }: PageProps<"/certificats/[id]">) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	const format: Format = query.format === "a5" ? "a5" : "a4";
	const f = FORMATS[format];
	const c = await apiGet<PrintedCertificate>(`/certificates/${id}/print`);
	const { cabinet, space } = c;
	const address = [space.address ?? cabinet.address, space.city ?? cabinet.city].filter(Boolean).join(", ");
	const phone = space.phone ?? cabinet.phone;
	const city = space.city ?? cabinet.city;

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
					"paper flex max-w-full flex-col bg-white p-[16mm] text-zinc-900 shadow-sm print:max-w-none print:shadow-none",
					f.width,
					f.height,
					f.text,
					// One sheet: a hair under the page, or the browser adds a blank one.
					format === "a5" ? "print:h-[209mm]" : "print:h-[296mm]",
				)}
			>
				<header className="border-primary flex items-start justify-between gap-6 border-b-2 pb-4">
					<div className="grid gap-0.5">
						<p className="text-primary text-lg leading-tight font-bold">{c.practitioner}</p>
						{cabinet.specialty && <p className="font-medium">{cabinet.specialty}</p>}
						<p className="text-zinc-600">{cabinet.legalName ?? cabinet.name}</p>
					</div>
					<div className="grid gap-0.5 text-end text-xs text-zinc-600">
						{address && <p>{address}</p>}
						{phone && <p>Tél. {formatPhone(phone)}</p>}
						<p>{cabinet.email}</p>
					</div>
				</header>

				<h1 className="mt-10 mb-8 text-center text-lg font-semibold tracking-[0.3em] uppercase">Certificat médical</h1>

				{/* Sanitized by the API: the editor's formatting only, no scripts or links. */}
				<div
					className="leading-relaxed [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:ps-6"
					dangerouslySetInnerHTML={{ __html: c.body }}
				/>

				<p className="mt-8 text-end">
					{city ? `Fait à ${city}, le ` : "Fait le "}
					{formatDate(c.createdAt)}
				</p>

				<footer className="mt-auto flex justify-end pt-8">
					<div className="grid h-28 w-56 place-items-end rounded-lg border border-dashed p-2 text-xs text-zinc-500">
						Cachet et signature
					</div>
				</footer>
			</article>
		</div>
	);
}
