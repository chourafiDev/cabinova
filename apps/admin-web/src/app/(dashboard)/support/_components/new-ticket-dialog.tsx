"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
	CHANNEL_LABELS,
	type CabinetOption,
	FIRST_RESPONSE_HOURS,
	PRIORITY_LABELS,
	type SupportAgent,
	TYPE_HINTS,
	TYPE_LABELS,
	type TicketPriority,
	type TicketType,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import { PriorityLabel } from "./ticket-badges";

const PLATFORM = "__platform";
const UNASSIGNED = "__none";

const schema = z
	.object({
		tenantId: z.string(),
		type: z.enum(["assistance", "incident", "configuration", "billing"]),
		priority: z.enum(["urgent", "high", "normal", "low"]),
		channel: z.enum(["phone", "email", "internal"]),
		subject: z.string().trim().min(3, "Objet requis").max(160),
		description: z.string().trim().min(3, "Décrivez la demande").max(10_000),
		requesterName: z.string().trim().max(120),
		requesterEmail: z.union([z.literal(""), z.email("Adresse e-mail invalide")]),
		assigneeId: z.string(),
		notify: z.boolean(),
	})
	.refine((v) => v.tenantId !== "" || v.type === "incident", {
		path: ["tenantId"],
		message: "Choisissez un cabinet",
	});
type TicketInput = z.infer<typeof schema>;

const hours = (h: number) => (h < 24 ? `${h} h` : `${h / 24} j`);

/**
 * Opens a ticket for a cabinet (taken by phone, received by e-mail, or our
 * own finding). Without a cabinet, only a platform-wide incident. The
 * cabinet's contact fills in by default.
 */
export function NewTicketDialog({
	cabinets,
	agents,
	meId,
	fixedCabinet,
	children,
}: {
	cabinets: CabinetOption[];
	agents: SupportAgent[];
	meId: string;
	/** From a cabinet's page: the cabinet is set. */
	fixedCabinet?: CabinetOption;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const empty: TicketInput = {
		tenantId: fixedCabinet?.id ?? "",
		type: "assistance",
		priority: "normal",
		channel: "phone",
		subject: "",
		description: "",
		requesterName: "",
		requesterEmail: "",
		assigneeId: agents.some((a) => a.id === meId) ? meId : UNASSIGNED,
		notify: true,
	};
	const form = useForm<TicketInput>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });
	const { errors, isSubmitting } = form.formState;
	const v = useWatch({ control: form.control });
	const cabinet = fixedCabinet ?? cabinets.find((c) => c.id === v.tenantId);
	const target = FIRST_RESPONSE_HOURS[(v.priority ?? "normal") as TicketPriority];

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) form.reset(empty);
	};

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const { id, number } = await api<{ id: string; number: string }>("/support/tickets", {
				method: "POST",
				body: JSON.stringify({
					tenantId: values.tenantId && values.tenantId !== PLATFORM ? values.tenantId : undefined,
					type: values.type,
					priority: values.priority,
					channel: values.channel,
					subject: values.subject,
					description: values.description,
					requesterName: values.requesterName || null,
					requesterEmail: values.requesterEmail || null,
					assigneeId: values.assigneeId === UNASSIGNED ? undefined : values.assigneeId,
					notify: values.channel !== "internal" && values.notify,
				}),
			});
			toast.success(`Ticket ${number} créé`);
			onOpenChange(false);
			router.push(`/support/${id}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Création impossible");
		}
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<form onSubmit={onSubmit} noValidate className="grid gap-5">
					<DialogHeader>
						<DialogTitle>Nouveau ticket</DialogTitle>
						<DialogDescription>
							{fixedCabinet ? `Pour ${fixedCabinet.name}. ` : ""}Notez la demande telle que le cabinet l’a formulée.
						</DialogDescription>
					</DialogHeader>

					<FieldGroup className="gap-5">
						<Field>
							<FieldLabel>Type de demande</FieldLabel>
							<Controller
								control={form.control}
								name="type"
								render={({ field }) => (
									<div className="grid gap-2 sm:grid-cols-4" role="radiogroup">
										{(Object.keys(TYPE_LABELS) as TicketType[]).map((t) => (
											<button
												key={t}
												type="button"
												role="radio"
												aria-checked={field.value === t}
												onClick={() => field.onChange(t)}
												className={cn(
													"grid gap-0.5 rounded-lg border p-2.5 text-start transition-colors hover:bg-muted/50",
													field.value === t && "border-primary bg-primary/5 ring-1 ring-primary",
												)}
											>
												<span className="text-sm font-medium">{TYPE_LABELS[t]}</span>
												<span className="text-[11px] leading-snug text-muted-foreground">{TYPE_HINTS[t]}</span>
											</button>
										))}
									</div>
								)}
							/>
						</Field>

						{!fixedCabinet && (
							<Field data-invalid={!!errors.tenantId}>
								<FieldLabel>Cabinet</FieldLabel>
								<Controller
									control={form.control}
									name="tenantId"
									render={({ field }) => (
										<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
											<PopoverTrigger asChild>
												<Button
													type="button"
													variant="outline"
													role="combobox"
													aria-invalid={!!errors.tenantId}
													className="justify-between font-normal"
												>
													{field.value === PLATFORM
														? "Toute la plateforme"
														: (cabinet?.name ?? <span className="text-muted-foreground">Choisir un cabinet…</span>)}
													<ChevronsUpDown className="opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
												<Command>
													<CommandInput placeholder="Nom, ville, responsable…" />
													<CommandList>
														<CommandEmpty>Aucun cabinet.</CommandEmpty>
														<CommandGroup>
															{v.type === "incident" && (
																<CommandItem
																	value="Toute la plateforme"
																	onSelect={() => {
																		field.onChange(PLATFORM);
																		setPickerOpen(false);
																	}}
																>
																	<Check className={cn(field.value === PLATFORM ? "opacity-100" : "opacity-0")} />
																	Toute la plateforme
																</CommandItem>
															)}
															{cabinets.map((c) => (
																<CommandItem
																	key={c.id}
																	value={`${c.name} ${c.city ?? ""} ${c.responsibleName}`}
																	onSelect={() => {
																		field.onChange(c.id);
																		setPickerOpen(false);
																	}}
																>
																	<Check className={cn(field.value === c.id ? "opacity-100" : "opacity-0")} />
																	<span className="grid leading-tight">
																		<span>{c.name}</span>
																		<span className="text-xs text-muted-foreground">
																			{[c.responsibleName, c.city].filter(Boolean).join(" · ")}
																		</span>
																	</span>
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
									)}
								/>
								<FieldError errors={[errors.tenantId]} />
							</Field>
						)}

						<Field data-invalid={!!errors.subject}>
							<FieldLabel htmlFor="ticket-subject">Objet</FieldLabel>
							<Input
								id="ticket-subject"
								placeholder="Ex. Impossible d’imprimer les ordonnances"
								aria-invalid={!!errors.subject}
								{...form.register("subject")}
							/>
							<FieldError errors={[errors.subject]} />
						</Field>
						<Field data-invalid={!!errors.description}>
							<FieldLabel htmlFor="ticket-description">Description</FieldLabel>
							<Textarea
								id="ticket-description"
								rows={4}
								placeholder="Ce que le cabinet constate, depuis quand, ce qu’il a déjà essayé…"
								aria-invalid={!!errors.description}
								{...form.register("description")}
							/>
							<FieldDescription>Aucune donnée de patient : décrivez le problème, pas le dossier.</FieldDescription>
							<FieldError errors={[errors.description]} />
						</Field>

						<div className="grid gap-5 sm:grid-cols-2">
							<Field>
								<FieldLabel>Priorité</FieldLabel>
								<Controller
									control={form.control}
									name="priority"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
													<SelectItem key={p} value={p}>
														<PriorityLabel priority={p} className="text-sm" />
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
								<FieldDescription>
									Première réponse sous {hours(target[0])}, {hours(target[1])} si le cabinet a le support prioritaire.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>Reçu par</FieldLabel>
								<Controller
									control={form.control}
									name="channel"
									render={({ field }) => (
										<div className="flex gap-1 rounded-lg bg-muted p-[3px] text-sm" role="radiogroup">
											{(["phone", "email", "internal"] as const).map((c) => (
												<button
													key={c}
													type="button"
													role="radio"
													aria-checked={field.value === c}
													onClick={() => field.onChange(c)}
													className={cn(
														"flex-1 rounded-md px-2 py-1 text-muted-foreground",
														field.value === c && "bg-background text-foreground shadow-sm",
													)}
												>
													{CHANNEL_LABELS[c]}
												</button>
											))}
										</div>
									)}
								/>
							</Field>
						</div>

						{v.tenantId !== PLATFORM && v.channel !== "internal" && (
							<div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="ticket-requester">Contact au cabinet</FieldLabel>
										<Input
											id="ticket-requester"
											placeholder={cabinet?.responsibleName ?? "Nom"}
											{...form.register("requesterName")}
										/>
									</Field>
									<Field data-invalid={!!errors.requesterEmail}>
										<FieldLabel htmlFor="ticket-email">E-mail pour les réponses</FieldLabel>
										<Input
											id="ticket-email"
											type="email"
											placeholder={cabinet?.email ?? "adresse@cabinet.ma"}
											aria-invalid={!!errors.requesterEmail}
											{...form.register("requesterEmail")}
										/>
										<FieldError errors={[errors.requesterEmail]} />
									</Field>
								</div>
								<p className="text-xs text-muted-foreground">Laissés vides : le responsable et l’e-mail du cabinet.</p>
								<Controller
									control={form.control}
									name="notify"
									render={({ field }) => (
										<label className="flex items-center gap-2 text-sm">
											<Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
											Envoyer un accusé de réception avec le numéro du ticket
										</label>
									)}
								/>
							</div>
						)}

						<Field className="sm:w-1/2">
							<FieldLabel>Assigné à</FieldLabel>
							<Controller
								control={form.control}
								name="assigneeId"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
											{agents.map((a) => (
												<SelectItem key={a.id} value={a.id}>
													{a.name}
													{a.id === meId && " (moi)"}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</Field>
					</FieldGroup>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader className="animate-spin" />} Créer le ticket
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
