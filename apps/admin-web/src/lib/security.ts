// Types and labels of the security API (apps/admin-api/src/security).
// Categories mirror apps/admin-api/src/security/catalog.ts.

export const AUDIT_CATEGORY_LABELS: Record<string, string> = {
	auth: "Connexions",
	tenants: "Cabinets",
	data: "Données",
	billing: "Facturation",
	plans: "Offres",
	features: "Fonctionnalités",
	support: "Support",
	settings: "Configuration",
	users: "Utilisateurs",
};

/** Human-readable label for each audited action; unknown ones show their code. */
export const ACTION_LABELS: Record<string, string> = {
	"auth.login": "Connexion",
	"auth.login_failed": "Échec de connexion",
	"auth.2fa_failed": "Code 2FA incorrect",
	"auth.2fa.enable": "Double authentification activée",
	"auth.2fa.disable": "Double authentification désactivée",
	"auth.2fa.recovery_used": "Code de secours utilisé",
	"auth.2fa.recovery_regenerate": "Codes de secours régénérés",
	"platform_user.invite": "Utilisateur invité",
	"platform_user.update": "Accès d’un utilisateur modifiés",
	"platform_user.deactivate": "Compte désactivé",
	"platform_user.reactivate": "Compte réactivé",
	"platform_user.link": "Lien de connexion envoyé",
	"platform_user.sessions_revoke": "Sessions fermées",
	"platform_user.2fa_reset": "2FA réinitialisée par un admin",
	"platform_role.update": "Permissions d’un rôle modifiées",
	"tenant.create": "Cabinet créé",
	"tenant.update": "Cabinet modifié",
	"tenant.status.apply": "Statut du cabinet changé",
	"tenant.status.schedule": "Changement de statut programmé",
	"tenant.status.cancel": "Changement de statut annulé",
	"tenant.status.failed": "Changement de statut non appliqué",
	"tenant.feature.override": "Exception de fonctionnalité",
	"tenant.feature.override_removed": "Exception retirée",
	"tenant.provision.start": "Provisionnement lancé",
	"tenant.provision.succeed": "Provisionnement terminé",
	"tenant.provision.fail": "Provisionnement échoué",
	"tenant.database.migrate": "Base migrée",
	"tenant.database.migrate_failed": "Migration échouée",
	"tenant.database.unreachable": "Base injoignable",
	"tenant.database.recovered": "Base de nouveau joignable",
	"tenant.data.export": "Données exportées",
	"tenant.data.delete": "Base supprimée définitivement",
	"settings.general.update": "Paramètres généraux modifiés",
	"settings.email.update": "Paramètres e-mail modifiés",
	"settings.notifications.update": "Notifications modifiées",
	"settings.languages.update": "Langues modifiées",
	"settings.branding.update": "Identité visuelle modifiée",
	"support.ticket.create": "Ticket ouvert",
	"support.ticket.update": "Ticket modifié",
	"support.ticket.reply": "Réponse envoyée au cabinet",
	"support.ticket.resolved": "Ticket résolu",
	"support.ticket.closed": "Ticket clôturé",
	"billing.invoice.issue": "Facture émise",
	"billing.invoice.overdue": "Facture en retard",
	"billing.invoice.void": "Facture annulée",
	"billing.payment.record": "Virement enregistré",
	"billing.subscription.change": "Abonnement modifié",
	"billing.subscription.attach": "Offre associée",
	"billing.subscription.past_due": "Paiement attendu",
	"billing.subscription.cancel_at_term": "Résiliation à l’échéance",
	"billing.subscription.cancelled": "Abonnement terminé",
	"billing.credit_note.issue": "Avoir émis",
	"billing.promo.create": "Code promo créé",
	"billing.promo.update": "Code promo modifié",
	"billing.promo.apply": "Code promo appliqué",
	"billing.promo.remove": "Code promo retiré",
	"settings.billing.update": "Coordonnées bancaires modifiées",
	"settings.compliance.update": "Durée de conservation modifiée",
	"plan.create": "Offre créée",
	"plan.update": "Offre modifiée",
	"feature.create": "Fonctionnalité créée",
	"feature.update": "Fonctionnalité modifiée",
	"feature.status.active": "Fonctionnalité activée",
	"feature.status.beta": "Fonctionnalité passée en bêta",
	"feature.status.disabled": "Fonctionnalité désactivée partout",
};

export type AuditEntry = {
	id: string;
	action: string;
	entity: string;
	metadata: Record<string, unknown> | null;
	ip: string | null;
	createdAt: string;
	actor: { id: string; name: string; email: string } | null;
	tenant: { id: string; name: string } | null;
	subjectUserId: string | null;
	category: string | null;
	sensitive: boolean;
};

export type AuditPage = { data: AuditEntry[]; total: number; pageCount: number };

export type SecuritySummary = {
	failedLogins24h: number;
	failedTwoFactor24h: number;
	sensitiveEvents7d: number;
	activeUsers: number;
	usersWithTwoFactor: number;
	usersWithoutTwoFactor: { id: string; name: string }[];
	categories: { key: string; label: string }[];
	actors: { id: string; name: string }[];
};

/** Creation-period presets for the journal. */
export const AUDIT_PERIODS: Record<string, { label: string; days?: number }> = {
	"24h": { label: "24 dernières heures", days: 1 },
	"7d": { label: "7 derniers jours", days: 7 },
	"30d": { label: "30 derniers jours", days: 30 },
	"90d": { label: "90 derniers jours", days: 90 },
	all: { label: "Tout l’historique" },
};

export type TenantDataExport = {
	id: string;
	sha256: string;
	sizeBytes: number;
	tables: Record<string, number>;
	schemaVersion: number | null;
	createdAt: string;
	requestedBy: string | null;
};

/** End of a cabinet's life: closure, retention, exports, deletion blockers. */
export type TenantDataStatus = {
	tenantStatus: string;
	database: { name: string | null; deletedAt: string | null } | null;
	retentionYears: number;
	closedAt: string | null;
	retentionEndsAt: string | null;
	exports: TenantDataExport[];
	canExport: boolean;
	canDelete: boolean;
	blockers: string[];
};

export const formatBytes = (n: number) =>
	n < 1024 ? `${n} o` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1024 ** 2).toFixed(1)} Mo`;
