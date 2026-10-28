import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import { PlatformConfigService } from '../settings/platform-config.service.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  /** False without RESEND_API_KEY: e-mails are only logged. */
  readonly delivers: boolean;
  private readonly from: string;
  private readonly publicOrigin: string;
  /** Development without Resend: unsent e-mails' links go to the log. */
  private readonly logLinks: boolean;

  constructor(
    config: ConfigService<Env, true>,
    private readonly platform: PlatformConfigService,
  ) {
    const apiKey = config.get('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.delivers = this.resend !== null;
    this.from = config.get('EMAIL_FROM');
    // Absolute links (logo) point at the admin app, which proxies /api.
    this.publicOrigin = config.get('WEB_ORIGIN').split(',')[0].trim();
    this.logLinks = config.get('NODE_ENV') === 'development';
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY is not set: emails are logged instead of sent.',
      );
    }
  }

  /** New member: choose a password to join the clinic. */
  async sendInvitation(to: {
    email: string;
    name: string;
    tenantName: string;
    url: string;
  }) {
    await this.send({
      to: to.email,
      subject: `Vous êtes invité(e) à rejoindre ${to.tenantName} sur {{PLATFORM}}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Vous avez été ajouté(e) à l'équipe de <strong>${escapeHtml(to.tenantName)}</strong> sur {{PLATFORM}}.</p>
        <p>Choisissez votre mot de passe pour accéder à votre espace :</p>
        ${button(to.url, 'Choisir mon mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois.</p>
      `,
    });
  }

  /** Existing member: reset their password. */
  async sendPasswordReset(to: {
    email: string;
    name: string;
    tenantName: string;
    url: string;
  }) {
    await this.send({
      to: to.email,
      subject: `Réinitialisation de votre mot de passe — ${to.tenantName}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Un nouveau lien pour choisir votre mot de passe sur <strong>${escapeHtml(to.tenantName)}</strong> a été généré.</p>
        ${button(to.url, 'Choisir un nouveau mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois. Les liens précédents ne fonctionnent plus. Si vous n'êtes pas à l'origine de cette demande, contactez l'administrateur de votre clinique.</p>
      `,
    });
  }

  /** Central (Super Admin side) account: first invitation or a new password link. */
  async sendPlatformAccess(to: {
    email: string;
    name: string;
    url: string;
    isReset: boolean;
  }) {
    await this.send({
      to: to.email,
      subject: to.isReset
        ? 'Nouveau mot de passe — administration {{PLATFORM}}'
        : 'Votre accès à l’administration {{PLATFORM}}',
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>${
          to.isReset
            ? 'Un lien pour choisir un nouveau mot de passe sur l’administration {{PLATFORM}} a été généré.'
            : 'Un accès à l’administration de la plateforme {{PLATFORM}} a été créé pour vous.'
        }</p>
        ${button(to.url, 'Choisir mon mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois. Si vous n'attendiez pas ce message, ignorez-le.</p>
      `,
    });
  }

  /**
   * Billing (Module 3): a new invoice to pay by bank transfer, an overdue
   * reminder, or the receipt once the transfer is recorded. The invoice
   * number doubles as the transfer reference.
   */
  async sendBillingNotice(to: {
    email: string;
    name: string;
    tenantName: string;
    kind:
      'invoice' | 'overdue' | 'receipt' | 'suspension_warning' | 'suspended';
    /** suspension_warning: the day access will be cut. */
    suspendOn?: Date;
    invoice: {
      number: string;
      description: string;
      amount: number;
      dueAt: Date;
    };
    /** Bank details, when configured. */
    bank: {
      accountHolder: string;
      bankName: string;
      rib: string;
      swift?: string;
    } | null;
  }) {
    const amount = new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(to.invoice.amount / 100);
    const due = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'long' }).format(
      to.invoice.dueAt,
    );
    const rib = to.bank
      ? `<table role="presentation" style="width:100%;margin:12px 0;border:1px solid #e5e7eb;border-radius:8px;font-size:13px">
          <tr><td style="padding:8px 12px;color:#6b7280">Titulaire</td><td style="padding:8px 12px">${escapeHtml(to.bank.accountHolder)}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">Banque</td><td style="padding:8px 12px">${escapeHtml(to.bank.bankName)}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">RIB</td><td style="padding:8px 12px;font-family:monospace">${escapeHtml(to.bank.rib.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, '$1 $2 $3 $4'))}</td></tr>
          ${to.bank.swift ? `<tr><td style="padding:8px 12px;color:#6b7280">SWIFT</td><td style="padding:8px 12px">${escapeHtml(to.bank.swift)}</td></tr>` : ''}
          <tr><td style="padding:8px 12px;color:#6b7280">Référence</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(to.invoice.number)}</td></tr>
        </table>`
      : '<p>Les coordonnées bancaires vous seront communiquées par le support {{PLATFORM}}.</p>';
    const intro = {
      invoice: `Votre facture <strong>${escapeHtml(to.invoice.number)}</strong> de <strong>${amount}</strong> est disponible (${escapeHtml(to.invoice.description)}). Merci de la régler par virement avant le <strong>${due}</strong>, en indiquant la référence ci-dessous.`,
      overdue: `Sauf erreur de notre part, la facture <strong>${escapeHtml(to.invoice.number)}</strong> de <strong>${amount}</strong>, échue le ${due}, n'a pas encore été réglée. Merci d'effectuer le virement dès que possible.`,
      receipt: `Nous avons bien reçu votre virement pour la facture <strong>${escapeHtml(to.invoice.number)}</strong> (${amount}). Merci ! Votre abonnement est à jour.`,
      suspension_warning: `La facture <strong>${escapeHtml(to.invoice.number)}</strong> de <strong>${amount}</strong>, échue le ${due}, n'est toujours pas réglée. Sans virement d'ici là, l'accès à votre espace sera suspendu le <strong>${to.suspendOn ? fmtDate(to.suspendOn) : ''}</strong>. Vos données restent conservées.`,
      suspended: `Faute de paiement de la facture <strong>${escapeHtml(to.invoice.number)}</strong> (${amount}), l'accès à votre espace est suspendu. Vos données sont conservées : dès réception de votre virement, l'accès est rétabli automatiquement.`,
    }[to.kind];
    const subject = {
      invoice: `Facture ${to.invoice.number} — ${to.tenantName}`,
      overdue: `Rappel : facture ${to.invoice.number} en attente de paiement`,
      receipt: `Paiement reçu — facture ${to.invoice.number}`,
      suspension_warning: `Dernier rappel : facture ${to.invoice.number} avant suspension`,
      suspended: `Accès suspendu — facture ${to.invoice.number} impayée`,
    }[to.kind];
    await this.send({
      to: to.email,
      subject,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>${intro}</p>
        ${to.kind === 'receipt' ? '' : rib}
        <p style="color:#6b7280;font-size:12px">Cabinet : ${escapeHtml(to.tenantName)}. Pour toute question, répondez à ce message.</p>
      `,
    });
  }

  /** "Your trial ends on …": what happens next and how to pay. */
  async sendTrialEnding(to: {
    email: string;
    name: string;
    tenantName: string;
    planName: string;
    endsAt: Date;
    /** Centimes per period, after discount. */
    amount: number;
    period: 'monthly' | 'annual';
  }) {
    const amount = new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(to.amount / 100);
    await this.send({
      to: to.email,
      subject: `Votre essai {{PLATFORM}} se termine le ${fmtDate(to.endsAt)}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>La période d'essai de <strong>${escapeHtml(to.tenantName)}</strong> se termine le <strong>${fmtDate(to.endsAt)}</strong>.</p>
        <p>Votre abonnement <strong>${escapeHtml(to.planName)}</strong> continuera ensuite à <strong>${amount}</strong> par ${to.period === 'annual' ? 'an' : 'mois'}. Vous recevrez la facture avec nos coordonnées bancaires pour le virement.</p>
        <p>Pour changer d'offre ou pour toute question, répondez simplement à ce message.</p>
      `,
    });
  }

  /** Avoir issued on a paid invoice: refunded, or credited on the next invoices. */
  async sendCreditNote(to: {
    email: string;
    name: string;
    tenantName: string;
    number: string;
    invoiceNumber: string;
    kind: 'refund' | 'credit';
    amount: number;
    reason: string;
  }) {
    const amount = new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(to.amount / 100);
    await this.send({
      to: to.email,
      subject: `Avoir ${to.number} — facture ${to.invoiceNumber}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Nous avons émis l'avoir <strong>${escapeHtml(to.number)}</strong> de <strong>${amount}</strong> sur la facture ${escapeHtml(to.invoiceNumber)} (${escapeHtml(to.reason)}).</p>
        <p>${
          to.kind === 'refund'
            ? 'Ce montant vous a été remboursé par virement.'
            : 'Ce montant sera déduit automatiquement de vos prochaines factures.'
        }</p>
        <p style="color:#6b7280;font-size:12px">Cabinet : ${escapeHtml(to.tenantName)}. Pour toute question, répondez à ce message.</p>
      `,
    });
  }

  /** Cabinet status change (suspension, reactivation, closure), Module 2. */
  async sendTenantStatusNotice(to: {
    email: string;
    name: string;
    tenantName: string;
    /** e.g. "suspendu", "réactivé" */
    outcome: string;
    /** Set when the change is scheduled rather than already applied. */
    effectiveOn?: string;
    comment: string;
  }) {
    const when = to.effectiveOn
      ? `sera ${escapeHtml(to.outcome)} à compter du ${escapeHtml(to.effectiveOn)}`
      : `a été ${escapeHtml(to.outcome)}`;
    await this.send({
      to: to.email,
      subject: `Votre cabinet ${to.tenantName} ${to.effectiveOn ? `sera ${to.outcome}` : `a été ${to.outcome}`}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Votre cabinet <strong>${escapeHtml(to.tenantName)}</strong> ${when} sur {{PLATFORM}}.</p>
        <p style="white-space:pre-line;border-inline-start:3px solid #e5e7eb;padding-inline-start:12px;color:#374151">${escapeHtml(to.comment)}</p>
        <p style="color:#6b7280;font-size:12px">Les données de votre cabinet sont conservées. Pour toute question, répondez à ce message ou contactez le support {{PLATFORM}}.</p>
      `,
    });
  }

  /**
   * Support (Module "Support et assistance"): an acknowledgement when a
   * ticket is opened, or an agent's reply. The ticket number in the subject
   * lets the cabinet's answer be matched to it.
   */
  async sendSupportMessage(to: {
    email: string;
    name: string | null;
    tenantName: string | null;
    ticket: { number: string; subject: string };
    kind: 'acknowledgement' | 'reply';
    body: string;
    agentName: string | null;
  }) {
    const intro =
      to.kind === 'acknowledgement'
        ? `Nous avons bien reçu votre demande <strong>${escapeHtml(to.ticket.number)}</strong> et nous la traitons.`
        : `Réponse à votre demande <strong>${escapeHtml(to.ticket.number)}</strong> :`;
    await this.send({
      to: to.email,
      subject: `[${to.ticket.number}] ${to.ticket.subject}`,
      body: `
        <p>Bonjour${to.name ? ` ${escapeHtml(to.name)}` : ''},</p>
        <p>${intro}</p>
        <p style="white-space:pre-line;border-inline-start:3px solid #e5e7eb;padding-inline-start:12px;color:#374151">${escapeHtml(to.body)}</p>
        <p>${to.agentName ? `${escapeHtml(to.agentName)}<br>` : ''}Support {{PLATFORM}}</p>
        <p style="color:#6b7280;font-size:12px">${to.tenantName ? `Cabinet : ${escapeHtml(to.tenantName)}. ` : ''}Pour répondre, répondez à ce message en gardant la référence ${escapeHtml(to.ticket.number)} dans l’objet.</p>
      `,
    });
  }

  /** "Paramètres → E-mails": proves the provider and sender work. */
  async sendTest(to: string) {
    await this.send({
      to,
      subject: 'E-mail de test — {{PLATFORM}}',
      body: `
        <p>Bonjour,</p>
        <p>Cet e-mail de test confirme que l’envoi fonctionne avec la configuration actuelle : expéditeur, adresse de réponse, signature et identité visuelle.</p>
      `,
    });
    return { delivered: !!this.resend };
  }

  /** Internal alert to the team's recipients (Paramètres → Notifications). */
  async sendTeamAlert(alert: {
    to: string[];
    subject: string;
    lines: string[];
    /** Admin path, e.g. "/support/…". */
    path: string;
  }) {
    for (const to of alert.to) {
      await this.send({
        to,
        subject: `[Alerte] ${alert.subject}`,
        body: `
          <p><strong>${escapeHtml(alert.subject)}</strong></p>
          ${alert.lines.map((l) => `<p style="margin:4px 0">${escapeHtml(l)}</p>`).join('')}
          ${button(`${this.publicOrigin}${alert.path}`, 'Ouvrir dans l’administration')}
          <p style="color:#6b7280;font-size:12px">Alerte envoyée à l’équipe {{PLATFORM}}. Réglez ces alertes dans Configuration → Notifications.</p>
        `,
        internal: true,
      });
    }
  }

  private async send(message: {
    to: string;
    subject: string;
    body: string;
    /** Team alerts: no signature or support footer. */
    internal?: boolean;
  }) {
    const { general, email, branding } = await this.platform.all();
    const name = general.platformName;
    const logoUrl = branding.logo
      ? `${this.publicOrigin}/api${(await this.platform.branding()).logoUrl}`
      : null;
    const html = layout(message.body, {
      name,
      color: branding.primaryColor,
      logoUrl,
      footer: message.internal
        ? null
        : [
            email.signature,
            [general.supportEmail, general.supportPhone, general.websiteUrl]
              .filter(Boolean)
              .join(' · ') || null,
          ],
    })
      .replaceAll('{{PLATFORM}}', escapeHtml(name))
      .replaceAll('{{BRAND}}', branding.primaryColor);
    const subject = message.subject.replaceAll('{{PLATFORM}}', name);
    const address = email.senderAddress ?? addressOf(this.from);
    const from = `${email.senderName.replace(/[<>"]/g, '')} <${address}>`;

    if (!this.resend) {
      this.logger.log(
        `[dev email] from="${from}" to=${message.to} subject="${subject}"`,
      );
      // Invitation and reset links carry tokens: logged in development only.
      if (this.logLinks) {
        for (const [, href] of html.matchAll(/href="(http[^"]+)"/g)) {
          if (!href.startsWith('mailto:'))
            this.logger.log(
              `[dev email]   link: ${href.replaceAll('&amp;', '&')}`,
            );
        }
      }
      return;
    }
    const { error } = await this.resend.emails.send({
      from,
      to: message.to,
      subject,
      html,
      ...(email.replyTo && { replyTo: email.replyTo }),
    });
    if (error) {
      // Never blocks the invite/reset flow: the UI still offers the link to copy.
      this.logger.error(`Email to ${message.to} failed: ${error.message}`);
    }
  }

  /** What the configuration page shows about delivery. */
  status() {
    return { provider: this.resend ? 'resend' : null, defaultFrom: this.from };
  }
}

/** "Name <a@b>" → "a@b". */
const addressOf = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from.trim();

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('fr-MA', {
    dateStyle: 'long',
    timeZone: 'Africa/Casablanca',
  }).format(d);

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function button(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:{{BRAND}};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">${escapeHtml(label)}</a>`;
}

function layout(
  body: string,
  brand: {
    name: string;
    color: string;
    logoUrl: string | null;
    /** Lines under the message (signature, support contact); null for internal alerts. */
    footer: (string | null)[] | null;
  },
) {
  const mark = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="" height="36" style="height:36px;max-width:160px;vertical-align:middle;border-radius:8px">`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:${brand.color};color:#fff;font-weight:700;font-size:16px">${escapeHtml(brand.name.charAt(0).toUpperCase())}</span>`;
  const footer = (brand.footer ?? []).filter(Boolean) as string[];
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f4f3f6;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border-top:4px solid ${brand.color}">
      <tr><td style="padding:24px 32px 0">
        ${mark}
        <span style="font-weight:700;font-size:16px;margin-inline-start:10px;vertical-align:middle">${escapeHtml(brand.name)}</span>
      </td></tr>
      <tr><td style="padding:24px 32px ${footer.length ? '16px' : '32px'};color:#111;font-size:14px;line-height:1.6">
        ${body}
      </td></tr>
      ${
        footer.length
          ? `<tr><td style="padding:16px 32px 24px;border-top:1px solid #f0eef3;color:#6b7280;font-size:12px;line-height:1.5;white-space:pre-line">${footer.map(escapeHtml).join('<br>')}</td></tr>`
          : ''
      }
    </table>
  </body>
</html>`;
}
