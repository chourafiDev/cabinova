"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user";
import {
	type AppIcon,
	IconCamera,
	IconDocument,
	IconDownload,
	IconFile,
	IconFolderOpen,
	IconIdCard,
	IconLab,
	IconPill,
	IconScan,
	IconSpinner,
	IconTrash,
	IconUpload,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import {
	ACCEPTED_TYPES,
	DOCUMENT_CATEGORIES,
	type DocumentCategory,
	documentsKey,
	documentUrl,
	MAX_DOCUMENT_BYTES,
	type PatientDocument,
} from "@/lib/documents";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<DocumentCategory, AppIcon> = {
	lab: IconLab,
	imaging: IconScan,
	prescription: IconPill,
	report: IconDocument,
	administrative: IconIdCard,
	other: IconFile,
};

/**
 * Documents, for the whole staff: the secretary scans or photographs what
 * the patient brings (analyses, radios, papers) and drops it here; the
 * doctor opens it from the file. Deleted by whoever added it, or the owner.
 */
export function DocumentsTab({ patientId, archived }: { patientId: string; archived: boolean }) {
	const t = useTranslations("patients.documents");
	const queryClient = useQueryClient();
	const documents = useQuery({
		queryKey: documentsKey(patientId),
		queryFn: () => api<PatientDocument[]>(`/patients/${patientId}/documents`),
	});
	const [category, setCategory] = useState<DocumentCategory>("lab");
	const [filter, setFilter] = useState<DocumentCategory | null>(null);
	// Names of the files on their way, shown as rows until they land.
	const [pending, setPending] = useState<string[]>([]);
	const [dragging, setDragging] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const camera = useRef<HTMLInputElement>(null);

	const upload = async (files: File[]) => {
		const valid = files.filter((file) => {
			if (!ACCEPTED_TYPES.includes(file.type)) toast.error(t("wrongType", { name: file.name }));
			else if (file.size > MAX_DOCUMENT_BYTES) toast.error(t("tooLarge", { name: file.name }));
			else return true;
			return false;
		});
		if (!valid.length) return;
		setPending((p) => [...p, ...valid.map((f) => f.name)]);
		let done = 0;
		// One after the other: a phone on the cabinet's Wi-Fi sends one well rather than five badly.
		for (const file of valid) {
			const form = new FormData();
			form.append("category", category);
			form.append("file", file);
			try {
				await api(`/patients/${patientId}/documents`, { method: "POST", body: form });
				done++;
			} catch (err) {
				toast.error(`${file.name} : ${err instanceof Error ? err.message : t("uploadError")}`);
			} finally {
				setPending((p) => {
					const i = p.indexOf(file.name);
					return p.filter((_, j) => j !== i);
				});
			}
		}
		await queryClient.invalidateQueries({ queryKey: documentsKey(patientId) });
		if (done) toast.success(t("uploaded", { count: done }));
	};

	const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
		void upload([...(e.target.files ?? [])]);
		e.target.value = "";
	};

	const all = documents.data ?? [];
	const present = DOCUMENT_CATEGORIES.filter((c) => all.some((d) => d.category === c));
	// A filter whose last document was deleted shows everything again.
	const active = filter && present.includes(filter) ? filter : null;
	const shown = active ? all.filter((d) => d.category === active) : all;

	return (
		<div className="grid gap-4">
			{archived ? (
				<p className="bg-muted/60 rounded-xl px-4 py-3 text-sm">{t("archived")}</p>
			) : (
				<section className="bg-card grid gap-3 rounded-xl border p-3">
					<div className="grid gap-2">
						<p id="document-category" className="text-muted-foreground px-0.5 text-xs font-medium">
							{t("classifyAs")}
						</p>
						<div role="radiogroup" aria-labelledby="document-category" className="flex flex-wrap gap-1.5 sm:grid sm:grid-cols-3">
							{DOCUMENT_CATEGORIES.map((c) => {
								const Icon = CATEGORY_ICONS[c];
								const checked = category === c;
								return (
									<Button
										key={c}
										type="button"
										role="radio"
										aria-checked={checked}
										variant="outline"
										size="sm"
										onClick={() => setCategory(c)}
										className={cn(
											"h-8 justify-start font-normal",
											checked && "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
										)}
									>
										<Icon /> {t(`categories.${c}`)}
									</Button>
								);
							})}
						</div>
					</div>

					<div
						onClick={(e) => {
							// The empty area opens the picker too; its buttons do their own thing.
							if (!(e.target as HTMLElement).closest("button")) input.current?.click();
						}}
						onDragOver={(e) => {
							e.preventDefault();
							setDragging(true);
						}}
						onDragLeave={(e) => {
							// Moving over a child isn't leaving.
							if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
						}}
						onDrop={(e) => {
							e.preventDefault();
							setDragging(false);
							void upload([...e.dataTransfer.files]);
						}}
						className={cn(
							"flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors",
							dragging ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
						)}
					>
						<span
							className={cn(
								"flex size-12 items-center justify-center rounded-full transition-all",
								dragging ? "bg-primary text-primary-foreground scale-110" : "bg-primary/12 text-primary",
							)}
						>
							<IconUpload className="size-5.5" />
						</span>
						<div className="grid gap-0.5">
							<p className="text-sm font-medium">
								{dragging ? (
									t("dropHere", { category: t(`categories.${category}`) })
								) : (
									<>
										{/* No dragging on a phone or tablet. */}
										<span className="pointer-coarse:hidden">{t("dropTitle")}</span>
										<span className="hidden pointer-coarse:inline">{t("addTitle")}</span>
									</>
								)}
							</p>
							<p className="text-muted-foreground text-xs">{t("accepted")}</p>
						</div>
						<div className="flex flex-wrap justify-center gap-2">
							<Button type="button" size="sm" onClick={() => input.current?.click()}>
								<IconUpload /> {t("choose")}
							</Button>
							{/* Phones and tablets: straight to the camera, for papers at the desk. */}
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="hidden pointer-coarse:inline-flex"
								onClick={() => camera.current?.click()}
							>
								<IconCamera /> {t("camera")}
							</Button>
						</div>
						{pending.length > 0 && (
							<p className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
								<IconSpinner className="size-3.5 animate-spin" /> {t("sending", { count: pending.length })}
							</p>
						)}
					</div>
					<input
						ref={input}
						type="file"
						multiple
						accept={ACCEPTED_TYPES.join(",")}
						className="sr-only"
						tabIndex={-1}
						aria-hidden
						onChange={picked}
					/>
					<input
						ref={camera}
						type="file"
						accept="image/*"
						capture="environment"
						className="sr-only"
						tabIndex={-1}
						aria-hidden
						onChange={picked}
					/>
				</section>
			)}

			{present.length > 1 && (
				<div className="flex flex-wrap gap-1.5">
					<FilterChip active={!active} onClick={() => setFilter(null)} count={all.length}>
						{t("all")}
					</FilterChip>
					{present.map((c) => (
						<FilterChip
							key={c}
							active={active === c}
							onClick={() => setFilter(c)}
							count={all.filter((d) => d.category === c).length}
						>
							{t(`categories.${c}`)}
						</FilterChip>
					))}
				</div>
			)}

			{documents.isPending ? (
				<Skeleton className="h-32" />
			) : !all.length && !pending.length ? (
				<div className="flex flex-col items-center gap-2 py-10 text-center">
					<IconFolderOpen className="text-muted-foreground size-6" />
					<p className="text-sm font-medium">{t("empty")}</p>
					<p className="text-muted-foreground max-w-xs text-xs">{t("emptyHint")}</p>
				</div>
			) : (
				<ul className="divide-y rounded-xl border">
					{pending.map((name, i) => (
						<li key={`${name}-${i}`} className="text-muted-foreground flex items-center gap-3 px-3 py-2.5 text-sm">
							<span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
								<IconSpinner className="size-4 animate-spin" />
							</span>
							<span className="min-w-0 flex-1 truncate">{name}</span>
							<span className="text-xs">{t("uploading")}</span>
						</li>
					))}
					{shown.map((d) => (
						<DocumentRow key={d.id} patientId={patientId} document={d} />
					))}
				</ul>
			)}
		</div>
	);
}

function FilterChip({
	active,
	onClick,
	count,
	children,
}: {
	active: boolean;
	onClick: () => void;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			aria-pressed={active}
			onClick={onClick}
			className={cn("h-7 font-normal", active && "border-primary bg-primary/10 text-primary hover:bg-primary/15")}
		>
			{children}
			<span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>
		</Button>
	);
}

function DocumentRow({ patientId, document: d }: { patientId: string; document: PatientDocument }) {
	const t = useTranslations("patients.documents");
	const format = useFormat();
	const user = useCurrentUser();
	const queryClient = useQueryClient();
	// Deleting can't be undone: a first click asks, a second one deletes.
	const [confirming, setConfirming] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const canDelete = user.role === "owner" || d.uploadedById === user.id;
	// An image that won't load (damaged scan) falls back to the file icon.
	const [broken, setBroken] = useState(false);
	const image = d.contentType.startsWith("image/") && !broken;
	const url = documentUrl(patientId, d.id);

	const remove = async () => {
		setDeleting(true);
		try {
			await api(`/patients/${patientId}/documents/${d.id}`, { method: "DELETE" });
			await queryClient.invalidateQueries({ queryKey: documentsKey(patientId) });
			toast.success(t("deleted"));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("deleteError"));
			setDeleting(false);
			setConfirming(false);
		}
	};

	return (
		<li className="flex items-center gap-3 px-3 py-2.5">
			<a href={url} target="_blank" rel="noopener" aria-label={t("open", { name: d.name })} className="shrink-0">
				{image ? (
					// eslint-disable-next-line @next/next/no-img-element -- an authenticated API file, not a static asset
					<img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="bg-muted size-10 rounded-lg border object-cover" />
				) : (
					<span className="flex size-10 items-center justify-center bg-primary/12 text-primary rounded-lg">
						<IconDocument className="size-4.5" />
					</span>
				)}
			</a>
			<div className="min-w-0 flex-1">
				<a href={url} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:underline" title={d.name}>
					{d.name}
				</a>
				<p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
					<Badge variant="secondary" className="h-4.5 px-1.5 text-[11px] font-normal">
						{t(`categories.${d.category}`)}
					</Badge>
					<span>{format.date(d.createdAt)}</span>
					<span aria-hidden>·</span>
					<span className="tabular-nums">{format.size(d.size)}</span>
					{d.uploadedBy && (
						<>
							<span aria-hidden>·</span>
							<span>{t("by", { name: d.uploadedBy })}</span>
						</>
					)}
				</p>
			</div>
			<Button asChild variant="ghost" size="icon" className="size-8" title={t("download")}>
				<a href={documentUrl(patientId, d.id, true)} aria-label={t("download")}>
					<IconDownload />
				</a>
			</Button>
			{canDelete &&
				(confirming ? (
					<Button variant="destructive" size="sm" className="h-8" disabled={deleting} onClick={remove} onBlur={() => setConfirming(false)}>
						{deleting ? <IconSpinner className="animate-spin" /> : <IconTrash />} {t("confirmDelete")}
					</Button>
				) : (
					<Button
						variant="ghost"
						size="icon"
						className="text-destructive hover:text-destructive size-8"
						title={t("delete")}
						aria-label={t("delete")}
						onClick={() => setConfirming(true)}
					>
						<IconTrash />
					</Button>
				))}
		</li>
	);
}
