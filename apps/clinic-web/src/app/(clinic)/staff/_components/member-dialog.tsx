"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconLock, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { spaceLabel } from "@/lib/spaces";
import { isFull, type Member, type MemberLink, quotaOf, ROLES, type StaffRole, type Team } from "@/lib/team";
import { cn } from "@/lib/utils";

/** Invite (member = null) or change a member's name, role and spaces. */
export function MemberDialog({
	team,
	member,
	open,
	onOpenChange,
	onInvited,
}: {
	team: Team;
	member: Member | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The invitation was created: show its link. */
	onInvited: (member: Member, link: MemberLink) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				{/* Remounted per opening: the fields start from this member. */}
				{open && (
					<MemberForm
						key={member?.id ?? "new"}
						team={team}
						member={member}
						onDone={() => onOpenChange(false)}
						onInvited={onInvited}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

type Errors = Partial<Record<"name" | "email" | "spaces" | "form", string>>;

function MemberForm({
	team,
	member,
	onDone,
	onInvited,
}: {
	team: Team;
	member: Member | null;
	onDone: () => void;
	onInvited: (member: Member, link: MemberLink) => void;
}) {
	const router = useRouter();
	const t = useTranslations("team.form");
	const common = useTranslations("common");
	const editing = member !== null;
	const singleSpace = team.spaces.length === 1;
	/** A role is closed when the offer is full, unless the member already has it. */
	const roleClosed = (role: StaffRole) => member?.role !== role && isFull(quotaOf(team, role));
	const [name, setName] = useState(member?.name ?? "");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<StaffRole | null>(
		member && member.role !== "owner"
			? member.role
			: (ROLES.find((r) => !roleClosed(r)) ?? null),
	);
	const [spaceIds, setSpaceIds] = useState<string[]>(
		member ? member.spaceIds : singleSpace ? [team.spaces[0].id] : [],
	);
	const [errors, setErrors] = useState<Errors>({});
	const [saving, setSaving] = useState(false);
	// A doctor with appointments to come stays a doctor (the API refuses too).
	const lockedDoctor = member?.role === "doctor" && member.upcomingAppointments > 0;

	/** An error goes away as soon as its field changes. */
	const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
	const toggleSpace = (id: string, on: boolean) => {
		setSpaceIds((ids) => (on ? [...ids, id] : ids.filter((s) => s !== id)));
		clear("spaces");
	};

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		const next: Errors = {};
		if (name.trim().length < 2) next.name = t("nameError");
		if (!editing && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("emailError");
		if (spaceIds.length === 0) next.spaces = t("spacesError");
		if (!role) next.form = t("noRoom");
		setErrors(next);
		if (Object.keys(next).length > 0 || !role) return;

		setSaving(true);
		try {
			const body = { name, role, spaceIds };
			if (editing) {
				await api(`/team/${member.id}`, { method: "PUT", body: JSON.stringify(body) });
				toast.success(t("saved"));
			} else {
				const res = await api<{ member: Member; link: MemberLink }>("/team", {
					method: "POST",
					body: JSON.stringify({ ...body, email }),
				});
				onInvited(res.member, res.link);
			}
			onDone();
			router.refresh();
		} catch (err) {
			if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setErrors({ email: err.message });
			else setErrors({ form: err instanceof Error ? err.message : t("saveError") });
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={save} noValidate className="grid gap-4">
			<DialogHeader>
				<DialogTitle>{editing ? t("editTitle", { name: member.name }) : t("inviteTitle")}</DialogTitle>
				<DialogDescription>
					{editing ? t("editHint") : t("inviteHint")}
				</DialogDescription>
			</DialogHeader>

			<FieldGroup className="gap-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="member-name">{t("name")}</FieldLabel>
						<Input
							id="member-name"
							autoFocus
							maxLength={120}
							placeholder={t("namePlaceholder")}
							value={name}
							aria-invalid={!!errors.name}
							onChange={(e) => {
								setName(e.target.value);
								clear("name");
							}}
						/>
						<FieldError>{errors.name}</FieldError>
					</Field>
					<Field data-invalid={!!errors.email}>
						<FieldLabel htmlFor="member-email">{t("email")}</FieldLabel>
						{editing ? (
							<div className="relative">
								<Input id="member-email" value={member.email} readOnly disabled className="pe-8" />
								<IconLock className="text-muted-foreground absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2" />
							</div>
						) : (
							<Input
								id="member-email"
								type="email"
								autoComplete="off"
								maxLength={200}
								placeholder={t("emailPlaceholder")}
								value={email}
								aria-invalid={!!errors.email}
								onChange={(e) => {
									setEmail(e.target.value);
									clear("email");
								}}
							/>
						)}
						<FieldError>{errors.email}</FieldError>
					</Field>
				</div>

				<FieldSet>
					<FieldLegend variant="label">{t("role")}</FieldLegend>
					<div role="radiogroup" aria-label={t("role")} className="grid gap-2 sm:grid-cols-2">
						{ROLES.map((r) => {
							const quota = quotaOf(team, r);
							const disabled = roleClosed(r) || (lockedDoctor && r !== "doctor");
							const selected = role === r;
							return (
								<button
									key={r}
									type="button"
									role="radio"
									aria-checked={selected}
									disabled={disabled}
									onClick={() => {
										setRole(r);
										clear("form");
									}}
									className={cn(
										"grid gap-1 rounded-lg border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50",
										selected ? "border-primary bg-primary/5 ring-primary ring-1" : "hover:bg-muted/50",
									)}
								>
									<span className="flex items-center justify-between gap-2 text-sm font-medium">
										{common(`roles.${r}`)}
										{quota.max !== null && (
											<span className="text-muted-foreground text-xs font-normal tabular-nums">
												{quota.used}/{quota.max}
											</span>
										)}
									</span>
									<span className="text-muted-foreground text-xs leading-snug">
										{roleClosed(r)
											? quota.max === 0
												? t("notIncluded")
												: t("roleFull")
											: t(`${r}Hint`)}
									</span>
								</button>
							);
						})}
					</div>
					{lockedDoctor && (
						<FieldDescription>
							{t("lockedDoctor")}
						</FieldDescription>
					)}
				</FieldSet>

				{!singleSpace && (
					<FieldSet data-invalid={!!errors.spaces}>
						<FieldLegend variant="label">{t("spaces")}</FieldLegend>
						<FieldDescription className="-mt-1">
							{t("spacesHint")}
						</FieldDescription>
						<div className="grid gap-2 sm:grid-cols-2">
							{team.spaces.map((s) => (
								<label
									key={s.id}
									className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
								>
									<Checkbox
										checked={spaceIds.includes(s.id)}
										onCheckedChange={(on) => toggleSpace(s.id, on === true)}
									/>
									{spaceLabel(s)}
								</label>
							))}
						</div>
						<FieldError>{errors.spaces}</FieldError>
					</FieldSet>
				)}
			</FieldGroup>

			{errors.form && (
				<p role="alert" className="text-destructive text-sm">
					{errors.form}
				</p>
			)}

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					{t("cancel")}
				</Button>
				<Button type="submit" disabled={saving}>
					{saving && <IconSpinner className="animate-spin" />} {editing ? t("save") : t("send")}
				</Button>
			</DialogFooter>
		</form>
	);
}
