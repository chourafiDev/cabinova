"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuLoader, LuLock } from "react-icons/lu";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { initials } from "@/lib/format";
import { SettingsCard } from "../../_components/settings-card";

export function ProfileForm({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
	const router = useRouter();
	const [saved, setSaved] = useState(name);
	const [value, setValue] = useState(name);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const dirty = value.trim() !== saved;
	const t = useTranslations("settings.profile");
	const common = useTranslations("settings.common");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (value.trim().length < 2) return setError(common("nameError"));
		setSaving(true);
		setError(null);
		try {
			const res = await api<{ name: string }>("/settings/profile", {
				method: "PUT",
				body: JSON.stringify({ name: value }),
			});
			setSaved(res.name);
			setValue(res.name);
			toast.success(t("saved"));
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : common("saveError"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={save} noValidate>
			<SettingsCard
				title={t("title")}
				description={t("description")}
				footer={
					<>
						<p className="text-muted-foreground text-xs">{t("visible")}</p>
						<Button type="submit" size="sm" disabled={!dirty || saving}>
							{saving && <LuLoader className="animate-spin" />} {common("save")}
						</Button>
					</>
				}
			>
				<div className="grid gap-5">
					<div className="flex items-center gap-3">
						<Avatar className="size-12 rounded-full">
							<AvatarFallback className="bg-primary/10 text-primary rounded-full font-medium">
								{initials(value.trim() || saved)}
							</AvatarFallback>
						</Avatar>
						<div className="grid gap-1">
							<span className="font-medium leading-tight">{value.trim() || saved}</span>
							<Badge variant="outline" className="w-fit font-normal">
								{roleLabel}
							</Badge>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="profile-name">{t("name")}</FieldLabel>
							<Input
								id="profile-name"
								value={value}
								maxLength={120}
								aria-invalid={!!error}
								onChange={(e) => setValue(e.target.value)}
							/>
							<FieldError>{error}</FieldError>
						</Field>
						<Field>
							<FieldLabel htmlFor="profile-email">{t("email")}</FieldLabel>
							<div className="relative">
								<Input id="profile-email" value={email} readOnly disabled className="pe-9" />
								<LuLock className="text-muted-foreground absolute end-3 top-1/2 size-3.5 -translate-y-1/2" />
							</div>
							<FieldDescription>{t("emailHint")}</FieldDescription>
						</Field>
					</div>
				</div>
			</SettingsCard>
		</form>
	);
}
