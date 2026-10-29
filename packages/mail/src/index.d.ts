export declare function escapeHtml(value: string): string;

/** A call-to-action link in the brand colour ({{BRAND}}, filled by the sender). */
export declare function button(url: string, label: string): string;

/** "Name <a@b>" → "a@b". */
export declare function addressOf(from: string): string;

/** The whole e-mail around a body: brand mark, message, footer lines. */
export declare function layout(
  body: string,
  brand: {
    name: string;
    color: string;
    logoUrl: string | null;
    /** Lines under the message (signature, support contact); null for internal alerts. */
    footer: (string | null)[] | null;
  },
): string;
