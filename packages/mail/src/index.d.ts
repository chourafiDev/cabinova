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

/** The devis e-mail: subject and body, to wrap in the sender's own layout. */
export declare function quoteEmail(quote: {
  kind: 'request' | 'trial_end' | 'reminder' | 'suspension_warning' | 'suspended';
  name: string;
  tenantName: string;
  number: string;
  description: string;
  /** Centimes. */
  amount: number;
  dueAt: Date;
  /** suspension_warning: the day access will be cut. */
  suspendOn?: Date;
  bank: {
    accountHolder: string;
    bankName: string;
    rib: string;
    swift?: string | null;
  } | null;
  /** Where to send the proof of transfer; null = reply to the e-mail. */
  proofEmail: string | null;
  /** The devis in the clinic app. */
  url: string;
}): { subject: string; body: string };
