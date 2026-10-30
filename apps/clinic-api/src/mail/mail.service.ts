import { createHash } from 'node:crypto';
import {
  addressOf,
  button,
  escapeHtml,
  layout,
  quoteEmail,
} from '@cabinova/mail';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import { CatalogService } from '../database/catalog.module.js';

/**
 * The parts of the platform configuration (Super Admin › Configuration)
 * an e-mail needs, with admin-api's defaults (platform-config.service.ts).
 */
const DEFAULTS = {
  general: {
    platformName: 'Cabinova',
    supportEmail: null as string | null,
    supportPhone: null as string | null,
    websiteUrl: null as string | null,
  },
  email: {
    senderName: 'Cabinova',
    senderAddress: null as string | null,
    replyTo: null as string | null,
    signature: null as string | null,
  },
  branding: { primaryColor: '#613f75', logo: null as string | null },
};
type Platform = typeof DEFAULTS;
const CACHE_MS = 30_000;

/** Delivered by Resend, only logged (no key), or refused by Resend. */
export type Delivery = 'sent' | 'logged' | 'failed';

/**
 * E-mails from the clinic app (Équipe invitations), in the platform's
 * branding read from the catalog. Never throws: the owner can always copy
 * the link instead.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly logoOrigin: string | null;
  private readonly logLinks: boolean;
  private cache: { at: number; value: Platform } | null = null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly catalog: CatalogService,
  ) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get('EMAIL_FROM');
    this.logoOrigin =
      config.get('PLATFORM_WEB_ORIGIN', { infer: true }) ?? null;
    this.logLinks = config.get('NODE_ENV') === 'development';
  }

  /** A new member: choose a password to join the cabinet. */
  sendInvitation(to: {
    email: string;
    name: string;
    cabinetName: string;
    invitedBy: string;
    roleLabel: string;
    url: string;
  }) {
    return this.send({
      to: to.email,
      subject: `${to.invitedBy} vous invite à rejoindre ${to.cabinetName} sur {{PLATFORM}}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>${escapeHtml(to.invitedBy)} vous a ajouté(e) à l’équipe de <strong>${escapeHtml(to.cabinetName)}</strong> sur {{PLATFORM}}, en tant que ${escapeHtml(to.roleLabel.toLowerCase())}.</p>
        <p>Choisissez votre mot de passe pour accéder au cabinet :</p>
        ${button(to.url, 'Choisir mon mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois.</p>
      `,
    });
  }

  /** An existing member: a new password, at the owner's request. */
  sendPasswordLink(to: {
    email: string;
    name: string;
    cabinetName: string;
    url: string;
  }) {
    return this.send({
      to: to.email,
      subject: `Nouveau mot de passe — ${to.cabinetName}`,
      body: `
        <p>Bonjour ${escapeHtml(to.name)},</p>
        <p>Le médecin responsable de <strong>${escapeHtml(to.cabinetName)}</strong> vous envoie un lien pour choisir un nouveau mot de passe.</p>
        ${button(to.url, 'Choisir un nouveau mot de passe')}
        <p style="color:#6b7280;font-size:12px">Ce lien est valable 7 jours et ne peut servir qu'une seule fois. Votre mot de passe actuel reste valable jusqu’à ce que vous en choisissiez un nouveau.</p>
      `,
    });
  }

  /** The devis the doctor just asked for. */
  sendQuote(to: Parameters<typeof quoteEmail>[0] & { email: string }) {
    return this.send({ to: to.email, ...quoteEmail(to) });
  }

  async supportEmail() {
    return (await this.platform()).general.supportEmail;
  }

  private async send(message: {
    to: string;
    subject: string;
    body: string;
  }): Promise<Delivery> {
    try {
      const { general, email, branding } = await this.platform();
      const name = general.platformName;
      const logoUrl =
        branding.logo && this.logoOrigin
          ? `${this.logoOrigin}/api/branding/logo?v=${createHash('sha256').update(branding.logo).digest('hex').slice(0, 10)}`
          : null;
      const html = layout(message.body, {
        name,
        color: branding.primaryColor,
        logoUrl,
        footer: [
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
        // Invitation links carry tokens: logged in development only.
        if (this.logLinks) {
          for (const [, href] of html.matchAll(/href="(http[^"]+)"/g)) {
            this.logger.log(
              `[dev email]   link: ${href.replaceAll('&amp;', '&')}`,
            );
          }
        }
        return 'logged';
      }
      const { error } = await this.resend.emails.send({
        from,
        to: message.to,
        subject,
        html,
        ...(email.replyTo && { replyTo: email.replyTo }),
      });
      if (error) {
        this.logger.error(`Email to ${message.to} failed: ${error.message}`);
        return 'failed';
      }
      return 'sent';
    } catch (err) {
      this.logger.error(`Email to ${message.to} failed: ${String(err)}`);
      return 'failed';
    }
  }

  /** platform_settings rows over the defaults, cached 30 s. */
  private async platform(): Promise<Platform> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.value;
    }
    const { rows } = await this.catalog.pool.query<{
      key: string;
      value: Record<string, unknown> | null;
    }>(
      `select key, value from platform_settings
        where key in ('settings.general', 'settings.email', 'settings.branding')`,
    );
    const stored = (section: string) =>
      rows.find((r) => r.key === `settings.${section}`)?.value ?? {};
    const value: Platform = {
      general: { ...DEFAULTS.general, ...stored('general') },
      email: { ...DEFAULTS.email, ...stored('email') },
      branding: { ...DEFAULTS.branding, ...stored('branding') },
    };
    this.cache = { at: Date.now(), value };
    return value;
  }
}
