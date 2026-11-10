"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { UnsavedChangesBar } from "../../_components/shared/unsaved-changes-bar";

/** Local edit state for one settings section; saved with PUT /settings/<section>. */
export function useSection<T>(initial: T, section: string) {
	const router = useRouter();
	const [value, setValue] = useState(initial);
	const [saved, setSaved] = useState(initial);
	const [saving, setSaving] = useState(false);
	const dirty = JSON.stringify(value) !== JSON.stringify(saved);

	const save = async (body: unknown = value) => {
		setSaving(true);
		try {
			await api(`/settings/${section}`, { method: "PUT", body: JSON.stringify(body) });
			setSaved(value);
			toast.success("Configuration enregistrée");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};
	const set = (patch: Partial<T>) => setValue((v) => ({ ...v, ...patch }));
	return { value, set, setValue, dirty, saving, save, discard: () => setValue(saved) };
}

/** A section: heading, the fields, and the unsaved-changes bar. */
export function SectionForm({
	title,
	description,
	dirty,
	saving,
	onSubmit,
	onDiscard,
	readOnly,
	children,
}: {
	title: string;
	description: string;
	dirty: boolean;
	saving: boolean;
	onSubmit: () => void;
	onDiscard: () => void;
	readOnly: boolean;
	children: React.ReactNode;
}) {
	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (!readOnly) onSubmit();
			}}
			className="grid gap-4"
		>
			<div className="grid gap-0.5">
				<h2 className="font-semibold">{title}</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<fieldset disabled={readOnly} className="grid gap-4">
				{children}
			</fieldset>
			<UnsavedChangesBar visible={dirty && !readOnly} label="Modifications non enregistrées" isSubmitting={saving} onDiscard={onDiscard} />
		</form>
	);
}

/** A bordered block grouping a few fields, with an optional caption. */
export function Block({ title, children, caption }: { title?: string; children: React.ReactNode; caption?: React.ReactNode }) {
	return (
		<div className="grid gap-4 rounded-xl border bg-card p-4">
			{title && <h3 className="text-sm font-medium">{title}</h3>}
			{children}
			{caption && <p className="text-xs text-muted-foreground">{caption}</p>}
		</div>
	);
}
