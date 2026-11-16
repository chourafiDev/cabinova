import sanitizeHtml from 'sanitize-html';

/**
 * What a rich-text field may hold (certificates, consultation notes,
 * antécédents): the editor's formatting, nothing else, so no scripts,
 * links or images get through.
 */
export function cleanBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'],
    allowedAttributes: { p: ['style'], li: ['style'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
  }).trim();
}

/** Cleaned HTML, or null when no text is left (an empty editor gives "<p></p>"). */
export function richOrNull(html: string | null | undefined) {
  if (!html) return null;
  const clean = cleanBody(html);
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} });
  return text.trim() === '' ? null : clean;
}
