"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuLoader, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SHEET_AT_END, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { BLANKS, BUILT_IN, type CertificateModel, MODELS_KEY } from "@/lib/certificates";

/** The doctor's own certificate models: written once, with blanks filled in when used. */
export function ModelsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const t = useTranslations("dossier.certificate.modelsSheet");
	const models = useQuery({
		queryKey: MODELS_KEY,
		queryFn: () => api<CertificateModel[]>("/certificate-models"),
		enabled: open,
	});
	// null: the list; "new" or a model: its form.
	const [editing, setEditing] = useState<CertificateModel | "new" | null>(null);

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setEditing(null);
			}}
		>
			<SheetContent className={`w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl ${SHEET_AT_END}`}>
				<SheetHeader className="border-b p-5">
					<SheetTitle>{t("title")}</SheetTitle>
					<SheetDescription>{t("description")}</SheetDescription>
				</SheetHeader>
				<div className="grid gap-4 p-5">
					{editing ? (
						<ModelForm
							key={editing === "new" ? "new" : editing.id}
							model={editing === "new" ? null : editing}
							onDone={() => setEditing(null)}
						/>
					) : (
						<>
							<Button className="w-fit" onClick={() => setEditing("new")}>
								<LuPlus /> {t("new")}
							</Button>
							{models.isPending ? (
								<Skeleton className="h-24" />
							) : !models.data?.length ? (
								<p className="text-muted-foreground text-sm">{t("empty")}</p>
							) : (
								<ul className="divide-y rounded-lg border">
									{models.data.map((m) => (
										<ModelRow key={m.id} model={m} onEdit={() => setEditing(m)} />
									))}
								</ul>
							)}
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function ModelRow({ model, onEdit }: { model: CertificateModel; onEdit: () => void }) {
	const t = useTranslations("dossier.certificate.modelsSheet");
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);

	const remove = async () => {
		setPending(true);
		try {
			await api(`/certificate-models/${model.id}`, { method: "DELETE" });
			await queryClient.invalidateQueries({ queryKey: MODELS_KEY });
			toast.success(t("deleted", { name: model.name }));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setPending(false);
			setConfirming(false);
		}
	};

	return (
		<li className="flex items-center gap-2 px-3 py-2.5">
			<span className="min-w-0 flex-1 truncate text-sm font-medium">{model.name}</span>
			<Button variant="ghost" size="icon" className="size-8" aria-label={t("edit", { name: model.name })} onClick={onEdit}>
				<LuPencil />
			</Button>
			{confirming ? (
				<Button variant="destructive" size="sm" className="h-8" disabled={pending} onClick={remove} onBlur={() => setConfirming(false)}>
					{pending ? <LuLoader className="animate-spin" /> : <LuTrash2 />} {t("confirmDelete")}
				</Button>
			) : (
				<Button
					variant="ghost"
					size="icon"
					className="text-destructive hover:text-destructive size-8"
					aria-label={t("delete", { name: model.name })}
					onClick={() => setConfirming(true)}
				>
					<LuTrash2 />
				</Button>
			)}
		</li>
	);
}

function ModelForm({ model, onDone }: { model: CertificateModel | null; onDone: () => void }) {
	const t = useTranslations("dossier.certificate.modelsSheet");
	const queryClient = useQueryClient();
	const [name, setName] = useState(model?.name ?? "");
	// A new model starts from Cabinova's, ready to be adapted.
	const [body, setBody] = useState(model?.body ?? BUILT_IN[0].body);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim().length < 2) return setError(t("nameError"));
		setSaving(true);
		setError(null);
		try {
			await api(model ? `/certificate-models/${model.id}` : "/certificate-models", {
				method: model ? "PUT" : "POST",
				body: JSON.stringify({ name, body }),
			});
			await queryClient.invalidateQueries({ queryKey: MODELS_KEY });
			toast.success(t("saved"));
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={save} className="grid gap-3">
			<label className="grid gap-1 text-sm">
				<span className="font-medium">{t("name")}</span>
				<Input autoFocus value={name} maxLength={80} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} />
			</label>
			<div className="grid gap-1 text-sm">
				<span className="font-medium">{t("text")}</span>
				<RichTextEditor value={body} onChange={setBody} />
				<p className="text-muted-foreground text-xs">
					{t("blanks")}{" "}
					{BLANKS.map((b) => (
						<code key={b} className="bg-muted me-1 rounded px-1 font-mono text-[11px]" dir="ltr">
							{`{${b}}`}
						</code>
					))}
				</p>
			</div>
			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onDone}>
					{t("cancel")}
				</Button>
				<Button type="submit" disabled={saving}>
					{saving && <LuLoader className="animate-spin" />} {t("save")}
				</Button>
			</div>
		</form>
	);
}
