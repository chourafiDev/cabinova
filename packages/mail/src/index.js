// Plain JavaScript (with index.d.ts) so both NestJS apps can run it from
// node_modules without a build step, like @cabinova/secret-box.

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
 */
export function layout(body, brand) {
  const mark = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="" height="36" style="height:36px;max-width:160px;vertical-align:middle;border-radius:8px">`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:${brand.color};color:#fff;font-weight:700;font-size:16px">${escapeHtml(brand.name.charAt(0).toUpperCase())}</span>`;
  const footer = /** @type {string[]} */ ((brand.footer ?? []).filter(Boolean));
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
