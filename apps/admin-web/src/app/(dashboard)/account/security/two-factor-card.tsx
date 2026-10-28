"use client";

import { LuCheck, LuCopy, LuDownload, LuKeyRound, LuLoader, LuShieldCheck, LuShieldOff, LuSmartphone } from "react-icons/lu";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { FormCard } from "../../_components/shared/form-card";

type Status = { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number };

/** Ten single-use backup codes, shown once: copy or download them. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
	const text = codes.join("\n");
	return (
		<div className="grid gap-3">
			<p className="text-sm">
				Gardez ces codes de secours en lieu sûr (gestionnaire de mots de passe, papier). Chacun permet de se connecter
				une fois si vous perdez votre téléphone. <strong>Ils ne seront plus affichés.</strong>
			</p>
			<ol className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
				{codes.map((c) => (
					<li key={c}>{c}</li>
				))}
			</ol>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={async () => {
						await navigator.clipboard.writeText(text);
						toast.success("Codes copiés");
					}}
				>
					<LuCopy /> Copier
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => {
						const url = URL.createObjectURL(new Blob([`Cabinova — codes de secours\n\n${text}\n`], { type: "text/plain" }));
						const a = Object.assign(document.createElement("a"), { href: url, download: "cabinova-codes-de-secours.txt" });
						a.click();
						URL.revokeObjectURL(url);
					}}
				>
					<LuDownload /> Télécharger
				</Button>
				<Button type="button" size="sm" className="ms-auto" onClick={onDone}>
					<LuCheck /> J’ai enregistré mes codes
				</Button>
			</div>
		</div>
	);
}

/** Asks for a code (app or backup) before a sensitive change. */
function CodeDialog({
	title,
	description,
	action,
	destructive,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	action: string;
	destructive?: boolean;
	onConfirm: (code: string) => Promise<void>;
	onClose: () => void;
}) {
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<form
					className="grid gap-4"
					onSubmit={async (e) => {
						e.preventDefault();
						setPending(true);
						setError(null);
						try {
							await onConfirm(code);
						} catch (err) {
							setError(err instanceof Error ? err.message : "Code incorrect");
							setPending(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<Field data-invalid={!!error}>
						<FieldLabel htmlFor="confirm-code">Code de l’application ou de secours</FieldLabel>
						<Input id="confirm-code" autoFocus autoComplete="one-time-code" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
						<FieldError errors={error ? [{ message: error }] : []} />
					</Field>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Annuler
						</Button>
						<Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || code.trim().length < 6}>
							{pending && <LuLoader className="animate-spin" />} {action}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * The signed-in admin's two-factor authentication: enrol (QR code →
 * first code → backup codes), regenerate backup codes, or turn it off.
 */
export function TwoFactorCard({ status }: { status: Status }) {
	const router = useRouter();
	const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
	const [qr, setQr] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [codes, setCodes] = useState<string[] | null>(null);
	const [dialog, setDialog] = useState<"disable" | "regenerate" | null>(null);

	useEffect(() => {
		if (!setup) return;
		void QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200, errorCorrectionLevel: "M" }).then(setQr);
	}, [setup]);

	const start = async () => {
		setPending(true);
		try {
			setSetup(await api("/auth/2fa/setup", { method: "POST" }));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Configuration impossible");
		} finally {
			setPending(false);
		}
	};

	const confirm = async (e: React.FormEvent) => {
		e.preventDefault();
		setPending(true);
		setError(null);
		try {
			const result = await api<{ recoveryCodes: string[] }>("/auth/2fa/enable", {
				method: "POST",
				body: JSON.stringify({ code }),
			});
			setCodes(result.recoveryCodes);
			setSetup(null);
			toast.success("Double authentification activée");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Code incorrect");
		} finally {
			setPending(false);
		}
	};

	const finish = () => {
		setCodes(null);
		router.refresh();
	};

	return (
		<FormCard
			title={
				<span className="flex items-center gap-2">
					Double authentification
					<Badge
						variant="outline"
						className={status.enabled ? "border-transparent bg-emerald-50 text-emerald-700" : "border-transparent bg-amber-50 text-amber-800"}
					>
						{status.enabled ? "Activée" : "Désactivée"}
					</Badge>
				</span>
			}
		>
			{codes ? (
				<RecoveryCodes codes={codes} onDone={finish} />
			) : setup ? (
				<form onSubmit={confirm} className="grid gap-5 sm:grid-cols-[200px_1fr]">
					<div className="grid justify-items-center gap-2">
						{qr ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={qr} alt="QR code à scanner avec l’application d’authentification" className="size-[200px] rounded-lg border bg-white p-1" />
						) : (
							<span className="flex size-[200px] items-center justify-center rounded-lg border">
								<LuLoader className="animate-spin text-muted-foreground" />
							</span>
						)}
					</div>
					<div className="grid content-start gap-4">
						<ol className="grid gap-1.5 text-sm">
							<li>
								<strong>1.</strong> Scannez le QR code avec Google Authenticator, Microsoft Authenticator, 1Password…
							</li>
							<li>
								<strong>2.</strong> Saisissez le code à 6 chiffres affiché pour Cabinova.
							</li>
						</ol>
						<Field>
							<FieldLabel>Impossible de scanner ? Clé à saisir</FieldLabel>
							<code className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
						</Field>
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="enable-code">Code de vérification</FieldLabel>
							<Input
								id="enable-code"
								autoFocus
								inputMode="numeric"
								autoComplete="one-time-code"
								maxLength={6}
								placeholder="123456"
								className="w-40 text-center font-mono tracking-[0.3em]"
								value={code}
								onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
							/>
							<FieldError errors={error ? [{ message: error }] : []} />
						</Field>
						<div className="flex gap-2">
							<Button type="submit" disabled={pending || code.length !== 6}>
								{pending && <LuLoader className="animate-spin" />} Activer
							</Button>
							<Button type="button" variant="ghost" onClick={() => setSetup(null)}>
								Annuler
							</Button>
						</div>
					</div>
				</form>
			) : status.enabled ? (
				<div className="grid gap-4">
					<div className="flex items-start gap-3 text-sm">
						<LuShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
						<p>
							Un code de votre application est demandé à chaque connexion, en plus du mot de passe.
							{status.enabledAt && ` Activée le ${formatDate(status.enabledAt)}.`}
						</p>
					</div>
					<div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
						<LuKeyRound className="size-4 text-muted-foreground" />
						<span className="flex-1">
							{status.recoveryCodesLeft} code{status.recoveryCodesLeft > 1 ? "s" : ""} de secours restant
							{status.recoveryCodesLeft > 1 ? "s" : ""}
						</span>
						{status.recoveryCodesLeft <= 3 && <span className="text-xs text-amber-700">Pensez à en générer de nouveaux</span>}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => setDialog("regenerate")}>
							<LuKeyRound /> Nouveaux codes de secours
						</Button>
						<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("disable")}>
							<LuShieldOff /> Désactiver
						</Button>
					</div>
				</div>
			) : (
				<div className="grid gap-4">
					<div className="flex items-start gap-3 text-sm">
						<LuSmartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
						<p>
							Protégez votre compte : en plus du mot de passe, un code à 6 chiffres de votre téléphone sera demandé à
							chaque connexion. Votre compte peut suspendre des cabinets et accéder à leurs données : c’est fortement
							recommandé.
						</p>
					</div>
					<div>
						<Button onClick={start} disabled={pending}>
							{pending && <LuLoader className="animate-spin" />}
							<LuShieldCheck /> Activer la double authentification
						</Button>
					</div>
				</div>
			)}

			{dialog === "disable" && (
				<CodeDialog
					title="Désactiver la double authentification ?"
					description="Votre compte ne sera plus protégé que par le mot de passe."
					action="Désactiver"
					destructive
					onClose={() => setDialog(null)}
					onConfirm={async (c) => {
						await api("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: c }) });
						toast.success("Double authentification désactivée");
						setDialog(null);
						router.refresh();
					}}
				/>
			)}
			{dialog === "regenerate" && (
				<CodeDialog
					title="Nouveaux codes de secours"
					description="Les anciens codes ne fonctionneront plus."
					action="Générer"
					onClose={() => setDialog(null)}
					onConfirm={async (c) => {
						const result = await api<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes", {
							method: "POST",
							body: JSON.stringify({ code: c }),
						});
						setDialog(null);
						setCodes(result.recoveryCodes);
					}}
				/>
			)}
		</FormCard>
	);
}
