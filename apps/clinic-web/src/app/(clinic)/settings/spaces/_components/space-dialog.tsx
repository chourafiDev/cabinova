"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuLoader } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ManagedSpace } from "@/lib/settings";
import { api } from "@/lib/api-client";

const fromSpace = (s: ManagedSpace | null) => ({
	name: s?.name ?? "",
	city: s?.city ?? "",
	address: s?.address ?? "",
	phone: s?.phone ?? "",
});

/** Create (space = null) or edit a space's name and contact details. */
export function SpaceDialog({
	space,
	open,
	onOpenChange,
}: {
	space: ManagedSpace | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{/* Remounted per opening: the fields start from this space. */}
				{open && <SpaceForm key={space?.id ?? "new"} space={space} onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function SpaceForm({ space, onDone }: { space: ManagedSpace | null; onDone: () => void }) {
	const router = useRouter();
	const [v, setV] = useState(() => fromSpace(space));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const t = useTranslations("settings.spaces");
	const common = useTranslations("settings.common");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (v.name.trim().length < 2) return setError(t("nameError"));
		setSaving(true);
		setError(null);
		try {
			await api(space ? `/spaces/${space.id}` : "/spaces", {
				method: space ? "PUT" : "POST",
				body: JSON.stringify(v),
			});
			toast.success(
				space ? t("saved") : t("created", { name: v.name.trim() }),
				space ? undefined : { description: t("createdHint") },
			);
			onDone();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : common("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={save} noValidate className="grid gap-4">
			<DialogHeader>
				<DialogTitle>{space ? t("editTitle") : t("newTitle")}</DialogTitle>
				<DialogDescription>
					{space ? t("editHint") : t("newHint")}
				</DialogDescription>
			</DialogHeader>
			<FieldGroup className="gap-4">
				<Field data-invalid={!!error}>
					<FieldLabel htmlFor="space-name">{t("name")}</FieldLabel>
					<Input
						id="space-name"
						autoFocus
						maxLength={80}
						placeholder={t("namePlaceholder")}
						value={v.name}
						aria-invalid={!!error}
						onChange={(e) => setV({ ...v, name: e.target.value })}
					/>
					<FieldError>{error}</FieldError>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="space-city">{t("city")}</FieldLabel>
						<Input id="space-city" maxLength={80} value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
					</Field>
					<Field>
						<FieldLabel htmlFor="space-phone">{t("phone")}</FieldLabel>
						<Input
							id="space-phone"
							type="tel"
							value={v.phone}
							onChange={(e) => setV({ ...v, phone: e.target.value })}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="space-address">{t("address")}</FieldLabel>
					<Input
						id="space-address"
						maxLength={300}
						value={v.address}
						onChange={(e) => setV({ ...v, address: e.target.value })}
					/>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					{common("cancel")}
				</Button>
				<Button type="submit" disabled={saving}>
					{saving && <LuLoader className="animate-spin" />} {space ? common("save") : t("create")}
				</Button>
			</DialogFooter>
		</form>
	);
}
