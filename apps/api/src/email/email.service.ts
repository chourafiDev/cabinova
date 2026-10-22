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
