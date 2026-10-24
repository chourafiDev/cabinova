import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get('EMAIL_FROM');
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
      subject: `Vous êtes invité(e) à rejoindre ${to.tenantName} sur Cabinova`,
      html: layout(`
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Vous avez été ajouté(e) à l'équipe de <strong>${escapeHtml(to.tenantName)}</strong> sur Cabinova.</p>
        <p>Choisissez votre mot de passe pour accéder à votre espace :</p>
        ${button(to.url, 'Choisir mon mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois.</p>
      `),
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
      html: layout(`
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Un nouveau lien pour choisir votre mot de passe sur <strong>${escapeHtml(to.tenantName)}</strong> a été généré.</p>
        ${button(to.url, 'Choisir un nouveau mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois. Les liens précédents ne fonctionnent plus. Si vous n'êtes pas à l'origine de cette demande, contactez l'administrateur de votre clinique.</p>
      `),
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
        ? 'Nouveau mot de passe — administration Cabinova'
        : 'Votre accès à l’administration Cabinova',
      html: layout(`
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>${
          to.isReset
            ? 'Un lien pour choisir un nouveau mot de passe sur l’administration Cabinova a été généré.'
            : 'Un accès à l’administration de la plateforme Cabinova a été créé pour vous.'
        }</p>
        ${button(to.url, 'Choisir mon mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois. Si vous n'attendiez pas ce message, ignorez-le.</p>
      `),
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
    kind: 'invoice' | 'overdue' | 'receipt';
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
      : '<p>Les coordonnées bancaires vous seront communiquées par le support Cabinova.</p>';
    const intro = {
      invoice: `Votre facture <strong>${escapeHtml(to.invoice.number)}</strong> de <strong>${amount}</strong> est disponible (${escapeHtml(to.invoice.description)}). Merci de la régler par virement avant le <strong>${due}</strong>, en indiquant la référence ci-dessous.`,
      overdue: `Sauf erreur de notre part, la facture <strong>${escapeHtml(to.invoice.number)}</strong> de <strong>${amount}</strong>, échue le ${due}, n'a pas encore été réglée. Merci d'effectuer le virement dès que possible.`,
      receipt: `Nous avons bien reçu votre virement pour la facture <strong>${escapeHtml(to.invoice.number)}</strong> (${amount}). Merci ! Votre abonnement est à jour.`,
    }[to.kind];
    const subject = {
      invoice: `Facture ${to.invoice.number} — ${to.tenantName}`,
      overdue: `Rappel : facture ${to.invoice.number} en attente de paiement`,
      receipt: `Paiement reçu — facture ${to.invoice.number}`,
    }[to.kind];
    await this.send({
      to: to.email,
      subject,
      html: layout(`
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>${intro}</p>
        ${to.kind === 'receipt' ? '' : rib}
        <p style="color:#6b7280;font-size:12px">Cabinet : ${escapeHtml(to.tenantName)}. Pour toute question, répondez à ce message.</p>
      `),
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
      html: layout(`
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Votre cabinet <strong>${escapeHtml(to.tenantName)}</strong> ${when} sur Cabinova.</p>
        <p style="white-space:pre-line;border-inline-start:3px solid #e5e7eb;padding-inline-start:12px;color:#374151">${escapeHtml(to.comment)}</p>
        <p style="color:#6b7280;font-size:12px">Les données de votre cabinet sont conservées. Pour toute question, répondez à ce message ou contactez le support Cabinova.</p>
      `),
    });
  }

  private async send(message: { to: string; subject: string; html: string }) {
    if (!this.resend) {
      this.logger.log(
        `[dev email] to=${message.to} subject="${message.subject}"`,
      );
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (error) {
      // Never blocks the invite/reset flow: the UI still offers the link to copy.
      this.logger.error(`Email to ${message.to} failed: ${error.message}`);
    }
  }
}

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
  return `<a href="${url}" style="display:inline-block;background:#613f75;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">${escapeHtml(label)}</a>`;
}

function layout(body: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f4f3f6;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px 32px 0">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:#613f75;color:#fff;font-weight:700;font-size:16px">C</span>
        <span style="font-weight:700;font-size:16px;margin-inline-start:10px;vertical-align:middle">Cabinova</span>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;color:#111;font-size:14px;line-height:1.6">
        ${body}
      </td></tr>
    </table>
  </body>
</html>`;
}
