// Plain JavaScript (with index.d.ts) so both NestJS apps can run it from
// node_modules without a build step, like @cabinova/secret-box.
import { moroccoZone } from '@cabinova/morocco-time';

/** @param {string} value */
export function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      /** @type {Record<string, string>} */ ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
}

/** @param {string} url @param {string} label */
export function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:{{BRAND}};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">${escapeHtml(label)}</a>`;
}

/** @param {string} from */
export const addressOf = (from) => /<([^>]+)>/.exec(from)?.[1] ?? from.trim();

/**
 * @param {string} body
 * @param {{ name: string; color: string; logoUrl: string | null; footer: (string | null)[] | null }} brand
 * @param {'fr' | 'ar'} [locale]
 */
export function layout(body, brand, locale = 'fr') {
  const mark = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="" height="36" style="height:36px;max-width:160px;vertical-align:middle;border-radius:8px">`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:${brand.color};color:#fff;font-weight:700;font-size:16px">${escapeHtml(brand.name.charAt(0).toUpperCase())}</span>`;
  const footer = /** @type {string[]} */ ((brand.footer ?? []).filter(Boolean));
  return `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
  <body style="margin:0;background:#f4f3f6;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <table role="presentation" dir="${locale === 'ar' ? 'rtl' : 'ltr'}" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border-top:4px solid ${brand.color}">
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

const intlLocale = (locale) => (locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA');

/** @param {number} centimes @param {'fr' | 'ar'} [locale] */
export const money = (centimes, locale = 'fr') =>
  new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: 'MAD',
  }).format(centimes / 100);

/** @param {Date} date @param {'fr' | 'ar'} [locale] */
export const longDate = (date, locale = 'fr') =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'long',
    timeZone: moroccoZone(date),
  }).format(date);

/** The account to pay by transfer; `reference` goes in the transfer label. */
export function bankDetails(bank, reference, locale = 'fr') {
  const ar = locale === 'ar';
  const row = (label, value, style = '') =>
    `<tr><td style="padding:8px 12px;color:#6b7280">${label}</td><td dir="auto" style="padding:8px 12px;${style}">${escapeHtml(value)}</td></tr>`;
  if (!bank) {
    return ar
      ? '<p>سيزودك دعم {{PLATFORM}} بالمعلومات البنكية.</p>'
      : '<p>Les coordonnées bancaires vous seront communiquées par le support {{PLATFORM}}.</p>';
  }
  return `<table role="presentation" style="width:100%;margin:12px 0;border:1px solid #e5e7eb;border-radius:8px;font-size:13px">
        ${row(ar ? 'صاحب الحساب' : 'Titulaire', bank.accountHolder)}
        ${row(ar ? 'البنك' : 'Banque', bank.bankName)}
        ${row('RIB', bank.rib.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, '$1 $2 $3 $4'), 'font-family:monospace')}
        ${bank.swift ? row('SWIFT', bank.swift) : ''}
        ${row(ar ? 'المرجع' : 'Référence', reference, 'font-weight:600')}
      </table>`;
}

/**
 * The devis e-mail, sent by clinic-api (the doctor asked) and admin-api
 * (trial end, reminders): how to pay, and where to send the proof.
 */
export function quoteEmail(q) {
  const locale = q.locale ?? 'fr';
  const number = escapeHtml(q.number);
  const amount = money(q.amount, locale);
  const due = longDate(q.dueAt, locale);
  const suspendOn = q.suspendOn ? longDate(q.suspendOn, locale) : '';
  const description = escapeHtml(q.description);
  const proofLink = q.proofEmail
    ? `<a href="mailto:${escapeHtml(q.proofEmail)}">${escapeHtml(q.proofEmail)}</a>`
    : null;
  const rib = bankDetails(q.bank, q.number, locale);
  if (locale === 'ar') {
    const intro = {
      request: `إليك عرض السعر <strong>${number}</strong> بمبلغ <strong>${amount}</strong> (${description}). يرجى أداؤه عبر تحويل بنكي قبل <strong>${due}</strong>.`,
      trial_end: `انتهت فترتك التجريبية المجانية. لمواصلة استعمال {{PLATFORM}}، إليك عرض السعر <strong>${number}</strong> بمبلغ <strong>${amount}</strong> (${description})، للأداء عبر تحويل بنكي قبل <strong>${due}</strong>.`,
      reminder: `ما لم نكن مخطئين، لم يتم بعد أداء عرض السعر <strong>${number}</strong> بمبلغ <strong>${amount}</strong>. يرجى إجراء التحويل في أقرب وقت.`,
      suspension_warning: `لم يتم بعد أداء عرض السعر <strong>${number}</strong> بمبلغ <strong>${amount}</strong>. بدون أداء، سيتم تعليق الوصول إلى فضائك بتاريخ <strong>${suspendOn}</strong>. تبقى بياناتك محفوظة.`,
      suspended: `بسبب عدم أداء عرض السعر <strong>${number}</strong> (${amount})، تم تعليق الوصول إلى فضائك. بياناتك محفوظة: يُعاد الوصول فور تأكيد الأداء.`,
    }[q.kind];
    const subject = {
      request: `عرض السعر ${q.number} — ${q.tenantName}`,
      trial_end: `انتهت فترتك التجريبية: عرض السعر ${q.number}`,
      reminder: `تذكير: عرض السعر ${q.number} في انتظار الأداء`,
      suspension_warning: `تذكير أخير: عرض السعر ${q.number} قبل التعليق`,
      suspended: `تم تعليق الوصول — عرض السعر ${q.number} غير مؤدى`,
    }[q.kind];
    return {
      subject,
      body: `
      <p>مرحبًا ${escapeHtml(q.name)}،</p>
      <p>${intro}</p>
      ${rib}
      <p>بعد إجراء التحويل، أرسل <strong>إشعار التحويل</strong> ${proofLink ? `إلى ${proofLink}` : 'ردًا على هذه الرسالة'}. سننشئ بعدها فاتورتك ويبدأ اشتراكك.</p>
      ${button(q.url, 'عرض عرض السعر')}
      <p style="color:#6b7280;font-size:12px">العيادة: ${escapeHtml(q.tenantName)}. لأي سؤال، أجب على هذه الرسالة.</p>
    `,
    };
  }
  const intro = {
    request: `Voici votre devis <strong>${number}</strong> de <strong>${amount}</strong> (${description}). Merci de le régler par virement avant le <strong>${due}</strong>.`,
    trial_end: `Votre essai gratuit est terminé. Pour continuer avec {{PLATFORM}}, voici votre devis <strong>${number}</strong> de <strong>${amount}</strong> (${description}), à régler par virement avant le <strong>${due}</strong>.`,
    reminder: `Sauf erreur de notre part, le devis <strong>${number}</strong> de <strong>${amount}</strong> n’a pas encore été réglé. Merci d’effectuer le virement dès que possible.`,
    suspension_warning: `Le devis <strong>${number}</strong> de <strong>${amount}</strong> n’est toujours pas réglé. Sans paiement d’ici là, l’accès à votre espace sera suspendu le <strong>${suspendOn}</strong>. Vos données restent conservées.`,
    suspended: `Faute de paiement du devis <strong>${number}</strong> (${amount}), l’accès à votre espace est suspendu. Vos données sont conservées : dès la confirmation de votre paiement, l’accès est rétabli.`,
  }[q.kind];
  const subject = {
    request: `Devis ${q.number} — ${q.tenantName}`,
    trial_end: `Votre essai est terminé : devis ${q.number}`,
    reminder: `Rappel : devis ${q.number} en attente de paiement`,
    suspension_warning: `Dernier rappel : devis ${q.number} avant suspension`,
    suspended: `Accès suspendu — devis ${q.number} impayé`,
  }[q.kind];
  return {
    subject,
    body: `
      <p>Bonjour ${escapeHtml(q.name)},</p>
      <p>${intro}</p>
      ${rib}
      <p>Une fois le virement effectué, envoyez votre <strong>avis de virement</strong> ${proofLink ? `à ${proofLink}` : 'en réponse à ce message'}. Nous créons alors votre facture et votre abonnement démarre.</p>
      ${button(q.url, 'Voir le devis')}
      <p style="color:#6b7280;font-size:12px">Cabinet : ${escapeHtml(q.tenantName)}. Pour toute question, répondez à ce message.</p>
    `,
  };
}
