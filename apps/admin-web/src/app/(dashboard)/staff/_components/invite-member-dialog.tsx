"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, MailCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import type { Role } from "@/lib/team";
import { AccessLink } from "./access-link";
import { RolePicker } from "./role-picker";

const schema = z.object({
	name: z.string().trim().min(2, "Nom trop court"),
	email: z.email("Adresse e-mail invalide"),
	roleIds: z.array(z.string()).min(1, "Choisissez au moins un rôle"),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", email: "", roleIds: [] };

/** Creates the member, e-mails them the invitation, and shows the link as a backup. */
export function InviteMemberDialog({ roles }: { roles: Role[] }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<{ email: string; url: string } | null>(null);
	const [, startRefresh] = useTransition();
	const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
	const { errors, isSubmitting } = form.formState;

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const { url } = await api<{ id: string; token: string; url: string }>("/users", {
				method: "POST",
				body: JSON.stringify(values),
			});
			setResult({ email: values.email, url });
			startRefresh(() => router.refresh());
		} catch (err) {
			if (err instanceof ApiError && err.code === "EMAIL_TAKEN") {
				form.setError("email", { message: err.message });
				return;
			}
			toast.error(err instanceof Error ? err.message : "Impossible d'ajouter le membre");
		}
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					form.reset(EMPTY);
					setResult(null);
				}
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button className="md:w-auto w-full">
					<UserPlus className="size-4" />
					Inviter un membre
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[630px]">
				{result ? (
					<>
						<DialogHeader>
							<div className="bg-primary/10 text-primary mb-1 flex size-10 items-center justify-center rounded-full">
								<MailCheck className="size-5" />
							</div>
							<DialogTitle>Invitation envoyée</DialogTitle>
							<DialogDescription>
								Un e-mail a été envoyé à <strong>{result.email}</strong> avec un lien pour choisir son
								mot de passe (valable 7 jours, usage unique). Si besoin, vous pouvez aussi copier ce lien
								directement :
							</DialogDescription>
						</DialogHeader>
						<AccessLink url={result.url} />
						<DialogFooter>
							<Button type="button" onClick={() => setOpen(false)}>
								Terminé
							</Button>
						</DialogFooter>
					</>
				) : (
					<form onSubmit={onSubmit} noValidate className="grid gap-4">
						<DialogHeader>
							<DialogTitle>Inviter un membre</DialogTitle>
							<DialogDescription>
								Ses permissions viennent de ses rôles ; vous pourrez les ajuster ensuite.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup className="gap-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<Field data-invalid={!!errors.name}>
									<FieldLabel htmlFor="member-name">Nom</FieldLabel>
									<Input id="member-name" aria-invalid={!!errors.name} {...form.register("name")} />
									<FieldError errors={[errors.name]} />
								</Field>
								<Field data-invalid={!!errors.email}>
									<FieldLabel htmlFor="member-email">E-mail</FieldLabel>
									<Input
										id="member-email"
										type="email"
										aria-invalid={!!errors.email}
										{...form.register("email")}
									/>
									<FieldError errors={[errors.email]} />
								</Field>
							</div>
							<Controller
								control={form.control}
								name="roleIds"
								render={({ field }) => (
									<Field data-invalid={!!errors.roleIds}>
										<FieldLabel>Rôles</FieldLabel>
										<RolePicker roles={roles} value={field.value} onChange={field.onChange} />
										<FieldError errors={[errors.roleIds]} />
									</Field>
								)}
							/>
						</FieldGroup>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Annuler
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting && <Loader className="size-4 animate-spin" />}
								Créer le lien d&apos;invitation
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
