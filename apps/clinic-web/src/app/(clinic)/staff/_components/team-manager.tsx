"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiIdentification } from "react-icons/hi2";
import {
	LuCalendarClock,
	LuEllipsis,
	LuKeyRound,
	LuLoader,
	LuMail,
	LuMapPin,
	LuPencil,
	LuShieldCheck,
	LuShieldOff,
	LuTrash2,
	LuUserCheck,
	LuUserPlus,
	LuUserX,
} from "react-icons/lu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { formatDate, initials } from "@/lib/format";
import { spaceLabel } from "@/lib/spaces";
import {
	isFull,
	type Member,
	type MemberLink,
	type MemberStatus,
	type Quota,
	STATUS_LABELS,
	type Team,
} from "@/lib/team";
import { cn } from "@/lib/utils";
import { LinkDialog } from "./link-dialog";
import { MemberDialog } from "./member-dialog";

const STATUS_BADGE: Record<MemberStatus, string> = {
	active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
	invited: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
	expired: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
	disabled: "bg-muted text-muted-foreground",
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const ago = (date: string) => formatDistanceToNowStrict(new Date(date), { locale: fr, addSuffix: true });

type Confirm = { kind: "deactivate" | "delete" | "reset2fa"; member: Member };

/** Équipe: the owner's view of the staff, with the offer's seats. */
export function TeamManager({ team, plan }: { team: Team; plan: string | null }) {
	const [editing, setEditing] = useState<Member | "new" | null>(null);
	const [link, setLink] = useState<{ member: Member; link: MemberLink } | null>(null);
	const [confirm, setConfirm] = useState<Confirm | null>(null);
	const current = team.members.filter((m) => m.status !== "disabled");
	const disabled = team.members.filter((m) => m.status === "disabled");
	const pending = current.filter((m) => m.status === "invited" || m.status === "expired").length;
	const { doctors, secretaries } = team.limits;
	const noRoom = isFull(doctors) && isFull(secretaries);

	const rowProps = {
		spaces: team.spaces,
		onEdit: (m: Member) => setEditing(m),
		onLink: (member: Member, l: MemberLink) => setLink({ member, link: l }),
		onConfirm: setConfirm,
	};

	return (
		<div className="grid gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
						<HiIdentification className="size-4" />
					</span>
					<div>
						<h1 className="text-lg font-semibold leading-tight">Équipe</h1>
						<p className="text-muted-foreground text-sm">
							{plural(current.length, "membre", "membres")}
							{pending > 0 && ` · ${plural(pending, "invitation en attente", "invitations en attente")}`}
						</p>
					</div>
				</div>
				<Button
					onClick={() => setEditing("new")}
					disabled={noRoom}
					title={noRoom ? "Votre offre est complète" : undefined}
				>
					<LuUserPlus /> Inviter un membre
				</Button>
			</header>

			<div className="grid gap-3 sm:grid-cols-2">
				<QuotaCard label="Médecins" hint="Vous compris" quota={doctors} plan={plan} />
				<QuotaCard label="Secrétaires" quota={secretaries} plan={plan} />
			</div>

			<RequireTwoFactor required={team.requireTwoFactor} ownEnabled={!!team.members.find((m) => m.role === "owner")?.twoFactor} />

			<section className="bg-card overflow-hidden rounded-xl border">
				<ul className="divide-y">
					{current.map((m) => (
						<MemberRow key={m.id} member={m} {...rowProps} />
					))}
				</ul>
				{current.length === 1 && (
					<div className="flex flex-col items-center gap-2 border-t px-6 py-10 text-center">
						<LuUserPlus className="text-muted-foreground size-6" />
						<p className="font-medium">Vous travaillez seul(e) pour l’instant</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							Invitez un médecin ou une secrétaire : ils reçoivent un e-mail pour choisir leur mot de passe.
						</p>
					</div>
				)}
			</section>

			{disabled.length > 0 && (
				<section className="grid gap-2">
					<h2 className="text-muted-foreground px-1 text-sm font-medium">Désactivés</h2>
					<div className="bg-card overflow-hidden rounded-xl border">
						<ul className="divide-y">
							{disabled.map((m) => (
								<MemberRow key={m.id} member={m} {...rowProps} />
							))}
						</ul>
					</div>
				</section>
			)}

			<MemberDialog
				team={team}
				member={editing === "new" ? null : editing}
				open={editing !== null}
				onOpenChange={(o) => !o && setEditing(null)}
				onInvited={(member, l) => setLink({ member, link: l })}
			/>
			<LinkDialog value={link} onOpenChange={(o) => !o && setLink(null)} />
			<ConfirmDialog value={confirm} onOpenChange={(o) => !o && setConfirm(null)} />
		</div>
	);
}

/** The owner requires two-factor sign-in, once their own account has it. */
function RequireTwoFactor({ required, ownEnabled }: { required: boolean; ownEnabled: boolean }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const change = async (next: boolean) => {
		setPending(true);
		try {
			await api("/team/two-factor", { method: "PUT", body: JSON.stringify({ required: next }) });
			toast.success(next ? "Double authentification obligatoire" : "Double authentification facultative");
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setPending(false);
		}
	};
	return (
		<section className="bg-brand dark:bg-brand/10 flex items-center gap-3 rounded-xl dark:border p-4">
			<LuShieldCheck className="text-white size-5 shrink-0" />
			<div className="min-w-0 flex-1">
				<p className="text-sm text-white font-medium">Double authentification obligatoire</p>
				<p className="text-white/60 text-xs">
					{ownEnabled ? (
						"Les membres sans double authentification doivent la configurer avant de continuer."
					) : (
						<>
							Activez-la d’abord sur votre compte, dans{" "}
							<Link href="/settings/profile" className="text-white underline underline-offset-2">
								Mon profil
							</Link>
							.
						</>
					)}
				</p>
			</div>
			<Switch
				aria-label="Double authentification obligatoire"
				checked={required}
				disabled={pending || (!ownEnabled && !required)}
				onCheckedChange={change}
			/>
		</section>
	);
}

function QuotaCard({ label, hint, quota, plan }: { label: string; hint?: string; quota: Quota; plan: string | null }) {
	const { used, max } = quota;
	const full = isFull(quota);
	return (
		<div className="bg-card grid gap-2 rounded-xl border p-4">
			<div className="flex items-baseline justify-between gap-2">
				<span className="text-sm font-medium">
					{label}
					{hint && <span className="text-muted-foreground font-normal"> · {hint}</span>}
				</span>
				<span className="text-sm tabular-nums">
					<span className="font-semibold">{used}</span>
					<span className="text-muted-foreground"> / {max ?? "illimité"}</span>
				</span>
			</div>
			{max !== null && max > 0 && (
				<div className="bg-muted h-1.5 overflow-hidden rounded-full">
					<div
						className={cn("h-full rounded-full", full ? "bg-amber-500" : "bg-primary")}
						style={{ width: `${Math.min(100, (used / max) * 100)}%` }}
					/>
				</div>
			)}
			<p className="text-muted-foreground text-xs">
				{max === 0
					? `Non compris dans l’offre${plan ? ` ${plan}` : ""}.`
					: full
						? `Offre${plan ? ` ${plan}` : ""} complète : désactivez un membre ou changez d’offre.`
						: max === null
							? "Sans limite dans votre offre."
							: `Encore ${plural(max - used, "place", "places")} dans l’offre${plan ? ` ${plan}` : ""}.`}
			</p>
		</div>
	);
}

function MemberRow({
	member: m,
	spaces,
	onEdit,
	onLink,
	onConfirm,
}: {
	member: Member;
	spaces: Team["spaces"];
	onEdit: (m: Member) => void;
	onLink: (m: Member, link: MemberLink) => void;
	onConfirm: (c: Confirm) => void;
}) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const owner = m.role === "owner";
	// Invited people get the invitation again; members a password link.
	const joined = m.status === "active";
	const memberSpaces = spaces.filter((s) => m.spaceIds.includes(s.id));

	const run = async (action: () => Promise<void>) => {
		setPending(true);
		try {
			await action();
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setPending(false);
		}
	};
	const issueLink = () =>
		run(async () => {
			const res = await api<{ member: Member; link: MemberLink }>(`/team/${m.id}/link`, { method: "POST" });
			onLink(res.member, res.link);
		});
	const reactivate = () =>
		run(async () => {
			await api(`/team/${m.id}/reactivate`, { method: "POST" });
			toast.success(`${m.name} est réactivé(e)`);
		});

	return (
		<li className={cn("flex items-start gap-3 p-4", m.status === "disabled" && "bg-muted/30")}>
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
					m.status === "disabled"
						? "bg-muted text-muted-foreground"
						: m.status === "active"
							? "bg-primary/10 text-primary"
							: "border-muted-foreground/40 text-muted-foreground border border-dashed",
				)}
				aria-hidden
			>
				{initials(m.name)}
			</span>
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="font-medium leading-tight">{m.name}</span>
					<Badge variant="outline" className="font-normal">
						{m.roleLabel}
					</Badge>
					{m.twoFactor && (
						<Badge variant="outline" className="gap-1 border-transparent bg-emerald-50 font-normal text-emerald-700">
							<LuShieldCheck className="size-3" /> 2FA
						</Badge>
					)}
					{!owner && m.status !== "active" && (
						<Badge variant="outline" className={cn("border-transparent font-normal", STATUS_BADGE[m.status])}>
							{STATUS_LABELS[m.status]}
						</Badge>
					)}
				</div>
				<p className="text-muted-foreground truncate text-sm">{m.email}</p>
				<p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					{owner ? (
						spaces.length > 1 && (
							<span className="inline-flex items-center gap-1">
								<LuMapPin className="size-3" /> Tous les espaces
							</span>
						)
					) : (
						spaces.length > 1 &&
						memberSpaces.length > 0 && (
							<span className="inline-flex items-center gap-1">
								<LuMapPin className="size-3" /> {memberSpaces.map(spaceLabel).join(", ")}
							</span>
						)
					)}
					{m.role !== "secretary" && m.upcomingAppointments > 0 && (
						<span className="inline-flex items-center gap-1">
							<LuCalendarClock className="size-3" /> {plural(m.upcomingAppointments, "RDV à venir", "RDV à venir")}
						</span>
					)}
					<span>
						{m.status === "invited" && m.inviteExpiresAt
							? `Lien valable jusqu’au ${formatDate(m.inviteExpiresAt, { year: undefined })}`
							: m.status === "expired"
								? "Le lien d’invitation a expiré"
								: m.lastLoginAt
									? `Dernière connexion ${ago(m.lastLoginAt)}`
									: "Jamais connecté(e)"}
					</span>
				</p>
			</div>

			{!owner &&
				(m.status === "disabled" ? (
					<Button variant="outline" size="sm" disabled={pending} onClick={reactivate}>
						{pending ? <LuLoader className="animate-spin" /> : <LuUserCheck />} Réactiver
					</Button>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-8" disabled={pending} aria-label={`Actions pour ${m.name}`}>
								{pending ? <LuLoader className="animate-spin" /> : <LuEllipsis />}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-56">
							<DropdownMenuItem onSelect={() => onEdit(m)}>
								<LuPencil /> Modifier le rôle et les espaces
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={issueLink}>
								{joined ? (
									<>
										<LuKeyRound /> Envoyer un lien de mot de passe
									</>
								) : (
									<>
										<LuMail /> Renvoyer l’invitation
									</>
								)}
							</DropdownMenuItem>
							{m.twoFactor && (
								<DropdownMenuItem onSelect={() => onConfirm({ kind: "reset2fa", member: m })}>
									<LuShieldOff /> Réinitialiser la double authentification
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							{joined ? (
								<DropdownMenuItem variant="destructive" onSelect={() => onConfirm({ kind: "deactivate", member: m })}>
									<LuUserX /> Désactiver
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem variant="destructive" onSelect={() => onConfirm({ kind: "delete", member: m })}>
									<LuTrash2 /> Supprimer l’invitation
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				))}
		</li>
	);
}

/** Deactivating a member, deleting an invitation, or a lost phone. */
function ConfirmDialog({ value, onOpenChange }: { value: Confirm | null; onOpenChange: (open: boolean) => void }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const m = value?.member;
	const deactivate = value?.kind === "deactivate";
	const reset = value?.kind === "reset2fa";
	const confirm = async () => {
		if (!m) return;
		setPending(true);
		try {
			if (reset) await api(`/team/${m.id}/two-factor/reset`, { method: "POST" });
			else if (deactivate) await api(`/team/${m.id}/deactivate`, { method: "POST" });
			else await api(`/team/${m.id}`, { method: "DELETE" });
			toast.success(
				reset ? "Double authentification réinitialisée" : deactivate ? `${m.name} est désactivé(e)` : "Invitation supprimée",
			);
			onOpenChange(false);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action impossible");
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={value !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{reset
							? `Réinitialiser la double authentification de ${m?.name} ?`
							: deactivate
								? `Désactiver ${m?.name} ?`
								: "Supprimer l’invitation ?"}
					</DialogTitle>
					<DialogDescription>
						{reset ? (
							<>
								À utiliser si cette personne a perdu son téléphone et ses codes de secours. Elle est déconnectée partout et
								reçoit un e-mail. Vérifiez sa demande de vive voix avant de confirmer.
							</>
						) : deactivate ? (
							<>
								Son accès est coupé tout de suite, sur tous ses appareils. Ses rendez-vous et ce qu’il ou elle a saisi
								sont conservés ; vous pourrez le ou la réactiver.
								{m && m.upcomingAppointments > 0 && (
									<span className="text-foreground mt-2 block font-medium">
										Attention : {plural(m.upcomingAppointments, "rendez-vous à venir est", "rendez-vous à venir sont")} à
										son nom.
									</span>
								)}
							</>
						) : (
							<>Le lien envoyé à {m?.email} ne fonctionnera plus. Vous pourrez l’inviter de nouveau plus tard.</>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
					<Button variant="destructive" disabled={pending} onClick={confirm}>
						{pending && <LuLoader className="animate-spin" />} {reset ? "Réinitialiser" : deactivate ? "Désactiver" : "Supprimer"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
