"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import type { PlatformRole } from "@/lib/platform-users";
import { AccessLink } from "./access-link";
import { RolePicker } from "./role-picker";

const schema = z.object({
	name: z.string().trim().min(2, "Nom requis").max(120),
	email: z.email("Adresse e-mail invalide"),
	roleKeys: z.array(z.string()).min(1, "Choisissez au moins un rôle"),
});
type InviteInput = z.infer<typeof schema>;

const EMPTY: InviteInput = { name: "", email: "", roleKeys: [] };

/**
 * Module 5 — invite a central user from the users list. Once sent, the
 * dialog shows the one-time link (also e-mailed) so it can be copied.
 */
export function InviteUserDialog({
	roles,
	myPermissions,
	children,
}: {
	roles: PlatformRole[];
	myPermissions: string[];
	children: React.ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [created, setCreated] = useState<{ id: string; name: string; url: string } | null>(null);
	const form = useForm<InviteInput>({
		resolver: zodResolver(schema),
		defaultValues: EMPTY,
		mode: "onTouched",
	});
	const { errors, isSubmitting } = form.formState;

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			form.reset(EMPTY);
			setCreated(null);
		}
	};

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const user = await api<{ id: string; name: string; url: string }>("/platform-users", {
				method: "POST",
				body: JSON.stringify(values),
			});
			toast.success("Invitation envoyée");
			setCreated(user);
			router.refresh();
		} catch (err) {
			if (err instanceof ApiError && err.code === "EMAIL_TAKEN") {
				form.setError("email", { message: err.message });
				return;
			}
			toast.error(err instanceof Error ? err.message : "Invitation impossible");
		}
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				{created ? (
					<div className="grid gap-4">
						<DialogHeader>
							<DialogTitle>{created.name} est invité(e)</DialogTitle>
							<DialogDescription>Le compte s’active quand le mot de passe est choisi.</DialogDescription>
						</DialogHeader>
						<AccessLink url={created.url} isReset={false} />
						<DialogFooter>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Fermer
							</Button>
							<Button asChild>
								<Link href={`/users/${created.id}`} onClick={() => onOpenChange(false)}>
									Voir l’utilisateur
								</Link>
							</Button>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={onSubmit} noValidate className="grid gap-4">
						<DialogHeader>
							<DialogTitle>Inviter un utilisateur</DialogTitle>
							<DialogDescription>
								Un lien valable 7 jours lui est envoyé pour choisir son mot de passe.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="gap-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<Field data-invalid={!!errors.name}>
									<FieldLabel htmlFor="invite-name">Nom</FieldLabel>
									<Input id="invite-name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
									<FieldError errors={[errors.name]} />
								</Field>
								<Field data-invalid={!!errors.email}>
									<FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
									<Input
										id="invite-email"
										type="email"
										aria-invalid={!!errors.email}
										{...form.register("email")}
									/>
									<FieldError errors={[errors.email]} />
								</Field>
							</div>
							{/* No data-invalid here: it would turn every role name red; the error line says it. */}
							<Field>
								<FieldLabel>Rôles</FieldLabel>
								<Controller
									control={form.control}
									name="roleKeys"
									render={({ field }) => (
										<RolePicker
											roles={roles}
											value={field.value}
											onChange={field.onChange}
											myPermissions={myPermissions}
											invalid={!!errors.roleKeys}
										/>
									)}
								/>
								<FieldError errors={[errors.roleKeys]} />
							</Field>
						</FieldGroup>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Annuler
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								Envoyer l’invitation
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
