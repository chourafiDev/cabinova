"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { type ChangeStatusInput, changeStatusSchema, TRANSITIONS, type TenantTransition } from "@/lib/tenants";

const today = () => format(new Date(), "yyyy-MM-dd");

/**
 * Module 2, Scenarios C and D: the status menu lists only the transitions
 * the API allows from the current status; each asks for a motive, a
 * comment and an effective date (today = now, later = scheduled).
 */
export function StatusActions({ tenantId, transitions }: { tenantId: string; transitions: TenantTransition[] }) {
	const [action, setAction] = useState<TenantTransition | null>(null);
	if (!transitions.length) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm">
						Statut<ChevronDown />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-46">
					{transitions.map((key) => (
						<DropdownMenuItem
							key={key}
							variant={TRANSITIONS[key].destructive ? "destructive" : "default"}
							onSelect={() => setAction(key)}
						>
							{TRANSITIONS[key].label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
				{action && <StatusChangeForm tenantId={tenantId} action={action} onDone={() => setAction(null)} />}
			</Dialog>
		</>
	);
}

function StatusChangeForm({
	tenantId,
	action,
	onDone,
}: {
	tenantId: string;
	action: TenantTransition;
	onDone: () => void;
}) {
	const router = useRouter();
	const transition = TRANSITIONS[action];
	const form = useForm<ChangeStatusInput>({
		resolver: zodResolver(changeStatusSchema),
		defaultValues: {
			reason: "",
			comment: "",
			effectiveOn: today(),
			notifyResponsible: true,
			retentionConfirmed: false,
		},
	});
	const { errors, isSubmitting } = form.formState;

	const onSubmit = form.handleSubmit(async (values) => {
		if (action === "close" && !values.retentionConfirmed) {
			form.setError("retentionConfirmed", { message: "Confirmation requise" });
			return;
		}
		const scheduled = values.effectiveOn > today();
		try {
			await api(`/tenants/${tenantId}/status-changes`, {
				method: "POST",
				body: JSON.stringify({
					action,
					reason: values.reason,
					comment: values.comment,
					// Start of the chosen day, in the admin's time zone.
					effectiveAt: scheduled ? new Date(`${values.effectiveOn}T00:00`).toISOString() : undefined,
					notifyResponsible: values.notifyResponsible,
					...(action === "close" && { retentionConfirmed: true }),
				}),
			});
			toast.success(scheduled ? "Changement de statut programmé" : "Statut mis à jour");
			onDone();
			router.refresh();
		} catch (err) {
			toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Action impossible");
		}
	});

	return (
		<DialogContent className="sm:max-w-lg">
			<form onSubmit={onSubmit} noValidate className="grid gap-4">
				<DialogHeader>
					<DialogTitle>{transition.label}</DialogTitle>
					<DialogDescription>{transition.description}</DialogDescription>
				</DialogHeader>

				<FieldGroup className="gap-4">
					<Field data-invalid={!!errors.reason}>
						<FieldLabel htmlFor="reason">Motif</FieldLabel>
						<Controller
							control={form.control}
							name="reason"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger id="reason" aria-invalid={!!errors.reason} className="w-full">
										<SelectValue placeholder="Choisir un motif" />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(transition.reasons).map(([key, label]) => (
											<SelectItem key={key} value={key}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
						<FieldError errors={[errors.reason]} />
					</Field>

					<Field data-invalid={!!errors.comment}>
						<FieldLabel htmlFor="comment">Commentaire</FieldLabel>
						<Textarea id="comment" rows={4} aria-invalid={!!errors.comment} {...form.register("comment")} />
						<FieldDescription>Conservé dans le journal d’audit et envoyé au responsable s’il est notifié.</FieldDescription>
						<FieldError errors={[errors.comment]} />
					</Field>

					<Field data-invalid={!!errors.effectiveOn}>
						<FieldLabel htmlFor="effectiveOn">Date d’effet</FieldLabel>
						<Input id="effectiveOn" type="date" min={today()} {...form.register("effectiveOn")} />
						<FieldDescription>Aujourd’hui : appliqué immédiatement. Plus tard : programmé.</FieldDescription>
					</Field>

					<Controller
						control={form.control}
						name="notifyResponsible"
						render={({ field }) => (
							<Field orientation="horizontal">
								<Checkbox id="notifyResponsible" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
								<FieldLabel htmlFor="notifyResponsible" className="font-normal">
									Notifier le médecin responsable par e-mail
								</FieldLabel>
							</Field>
						)}
					/>

					{action === "close" && (
						<Controller
							control={form.control}
							name="retentionConfirmed"
							render={({ field }) => (
								<Field orientation="horizontal" data-invalid={!!errors.retentionConfirmed}>
									<Checkbox
										id="retentionConfirmed"
										checked={field.value}
										aria-invalid={!!errors.retentionConfirmed}
										onCheckedChange={(v) => field.onChange(v === true)}
									/>
									<FieldLabel htmlFor="retentionConfirmed" className="font-normal">
										L’export des données a été préparé et les obligations de conservation vérifiées.
									</FieldLabel>
								</Field>
							)}
						/>
					)}
				</FieldGroup>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
						Annuler
					</Button>
					<Button type="submit" variant={transition.destructive ? "destructive" : "default"} disabled={isSubmitting}>
						{transition.label}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
