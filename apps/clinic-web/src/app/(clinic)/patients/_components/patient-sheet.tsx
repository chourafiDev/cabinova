"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SHEET_AT_END, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api-client";
import type { Appointment } from "@/lib/appointments";
import { EMPTY_PATIENT, formatFileNumber, fullName, type PatientFile, toInput } from "@/lib/patients";
import { PatientDetails } from "./patient-details";
import { PatientForm } from "./patient-form";

const params = {
	/** The patient whose file is open. */
	patient: parseAsString,
	/** "1": the new-patient form. */
	nouveau: parseAsString,
	/** "1": the open patient in edit mode. */
	modifier: parseAsString,
};

/**
 * The patient sheet over the Patients list: the file, the edit form, or a
 * new patient — all in the URL (?patient=…, &modifier=1, ?nouveau=1), so
 * refresh, back and shared links reopen it. The list behind refreshes after
 * a change.
 */
export function PatientSheet({
	medical,
	withinDossier,
}: {
	medical: boolean;
	/** Over the doctor's dossier: the file only, nothing that leaves the page. */
	withinDossier?: boolean;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const t = useTranslations("patients");
	const [{ patient: id, nouveau, modifier }, setParams] = useQueryStates(params, { history: "push", scroll: false });
	const creating = nouveau === "1";
	const editing = !!id && modifier === "1";
	const open = creating || !!id;

	const patient = useQuery({
		queryKey: ["patient", id],
		queryFn: () => api<PatientFile>(`/patients/${id}`),
		enabled: !!id,
		retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
	});
	const appointments = useQuery({
		queryKey: ["patient-appointments", id],
		queryFn: () => api<Appointment[]>(`/appointments?patientId=${id}&includeCancelled=true`),
		enabled: !!id && !editing,
	});

	const close = () => setParams({ patient: null, nouveau: null, modifier: null });
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["patient", id] });
		void queryClient.invalidateQueries({ queryKey: ["patient-appointments", id] });
		router.refresh(); // the list behind
	};

	const p = patient.data;

	return (
		<Sheet open={open} onOpenChange={(next) => !next && close()}>
			<SheetContent className={`w-full gap-0 data-[side=right]:sm:max-w-2xl ${SHEET_AT_END}`}>
				{creating ? (
					<>
						<SheetHeader className="border-b p-5">
							<SheetTitle className="text-xl">{t("new")}</SheetTitle>
							<SheetDescription>{t("sheet.newDescription")}</SheetDescription>
						</SheetHeader>
						<PatientForm
							key="new"
							defaultValues={EMPTY_PATIENT}
							onCancel={close}
							onSaved={(created, next) => {
								// Navigating away loads fresh data anyway; a refresh racing the push
								// would remount the agenda and lose its booking dialog.
								if (next === "book") return router.push(`/appointments?book=${created.id}`);
								router.refresh();
								void setParams({ nouveau: null, patient: created.id });
							}}
						/>
					</>
				) : patient.isError ? (
					<>
						<SheetHeader className="border-b p-5">
							<SheetTitle>{t("sheet.notFound")}</SheetTitle>
							<SheetDescription>
								{patient.error instanceof ApiError && patient.error.status === 404
									? t("sheet.notInSpace")
									: t("sheet.loadError")}
							</SheetDescription>
						</SheetHeader>
					</>
				) : !p ? (
					<>
						<SheetHeader className="sr-only">
							<SheetTitle>{t("sheet.loading")}</SheetTitle>
							<SheetDescription>{t("sheet.patient")}</SheetDescription>
						</SheetHeader>
						<div className="grid gap-4 p-5">
							<div className="flex items-center gap-3.5">
								<Skeleton className="size-12 rounded-2xl" />
								<div className="grid gap-2">
									<Skeleton className="h-5 w-48" />
									<Skeleton className="h-4 w-32" />
								</div>
							</div>
							<Skeleton className="h-8 w-64" />
							<Skeleton className="h-28 w-full rounded-xl" />
							<Skeleton className="h-28 w-full rounded-xl" />
						</div>
					</>
				) : editing ? (
					<>
						<SheetHeader className="border-b p-5">
							<SheetTitle className="text-xl">{t("sheet.editTitle")}</SheetTitle>
							<SheetDescription>
								{fullName(p)} · {formatFileNumber(p.fileNumber)}
							</SheetDescription>
						</SheetHeader>
						<PatientForm
							key={`edit-${p.id}-${p.updatedAt}`}
							patientId={p.id}
							defaultValues={toInput(p)}
							onCancel={() => setParams({ modifier: null })}
							onSaved={() => {
								refresh();
								void setParams({ modifier: null });
							}}
						/>
					</>
				) : (
					<PatientDetails
						patient={p}
						appointments={appointments.data}
						medical={medical}
						withinDossier={withinDossier}
						onEdit={() => setParams({ modifier: "1" })}
						onChanged={refresh}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
