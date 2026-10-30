import type { TenantStatus } from "./tenants";

// Types and labels of the billing API (apps/admin-api/src/billing). Payment
// is by bank transfer to the platform's RIB; an admin records each transfer.

export type InvoiceStatus = "billed" | "overdue" | "paid" | "void" | "refunded";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
	billed: "À payer",
	overdue: "En retard",
	paid: "Payée",
	void: "Annulée",
	refunded: "Remboursée",
};

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, string> = {
	billed: "bg-sky-50 text-sky-700",
	overdue: "bg-red-50 text-red-700",
	paid: "bg-emerald-50 text-emerald-700",
	void: "bg-zinc-100 text-zinc-500 line-through",
	refunded: "bg-zinc-100 text-zinc-600",
};

export type Invoice = {
	id: string;
	number: string;
	tenantId: string;
	subscriptionId: string | null;
	description: string;
	/** Centimes. */
	amount: number;
	currency: string;
	status: InvoiceStatus;
	periodStart: string;
	periodEnd: string;
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	/** Centimes of avoir deducted; `amount` is after it. */
	creditApplied: number;
	tenant: { id: string; name: string; status: TenantStatus };
};

export type InvoicesPage = {
	totals: { open: number; overdue: number; overdueCount: number; collectedThisMonth: number };
	data: Invoice[];
};

export type BillingSettings =
	| {
			configured: true;
			companyName: string;
			address?: string;
			email?: string;
			ice?: string;
			rc?: string;
			taxId?: string;
			accountHolder: string;
			bankName: string;
			rib: string;
			swift?: string;
			graceDays: number;
			invoiceDaysBefore: number;
			trialReminderDays: number;
			suspendAfterDays: number;
	  }
	| { configured: false; graceDays: number; invoiceDaysBefore: number; trialReminderDays: number; suspendAfterDays: number };

export type CreditNote = {
	id: string;
	number: string;
	kind: "refund" | "credit";
	/** Centimes. */
	amount: number;
	/** Credit still to deduct from future invoices. */
	remaining: number;
	reason: string;
	refundedAt: string | null;
	refundReference: string | null;
	createdAt: string;
	issuedBy: string | null;
	invoiceId?: string;
	invoiceNumber?: string;
};

export const CREDIT_NOTE_KIND_LABELS = { refund: "Remboursement", credit: "Crédit sur prochaines factures" } as const;

export type PromoCode = {
	id: string;
	code: string;
	description: string | null;
	discountPercent: number;
	durationInvoices: number | null;
	planKeys: string[];
	validUntil: string | null;
	maxRedemptions: number | null;
	active: boolean;
	redemptions: number;
	state: "active" | "disabled" | "expired" | "exhausted";
	createdAt: string;
};

export type InvoiceDetail = Omit<Invoice, "tenant"> & {
	tenant: {
		id: string;
		name: string;
		legalName: string | null;
		address: string | null;
		city: string | null;
		email: string;
		responsibleName: string;
		status: TenantStatus;
	};
	payments: {
		id: string;
		amount: number;
		receivedAt: string;
		reference: string | null;
		note: string | null;
		recordedBy: string | null;
	}[];
	issuer: BillingSettings;
	creditNotes: CreditNote[];
	/** Centimes that can still be refunded or credited. */
	creditable: number;
};

export type QuoteStatus = "pending" | "paid" | "void";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
	pending: "En attente",
	paid: "Payé",
	void: "Annulé",
};

export const QUOTE_STATUS_TONES: Record<QuoteStatus, string> = {
	pending: "bg-sky-50 text-sky-700",
	paid: "bg-emerald-50 text-emerald-700",
	void: "bg-zinc-100 text-zinc-500 line-through",
};

export type Quote = {
	id: string;
	number: string;
	tenantId: string;
	billingPeriod: "monthly" | "annual";
	description: string;
	/** Centimes. */
	amount: number;
	status: QuoteStatus;
	source: string;
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	planName: string;
	invoiceId: string | null;
	invoiceNumber: string | null;
	tenant: { id: string; name: string; status: TenantStatus };
};

export type QuoteDetail = Omit<Quote, "tenant"> & {
	tenant: {
		id: string;
		name: string;
		legalName: string | null;
		address: string | null;
		city: string | null;
		email: string;
		responsibleName: string;
	};
	issuer: BillingSettings;
};

export type TenantBilling = {
	/** No facture yet: the next step for this cabinet is a devis. */
	quoteable: boolean;
	quotes: Quote[];
	subscription: {
		id: string;
		status: "trialing" | "active" | "past_due" | "cancelled";
		billingPeriod: "monthly" | "annual";
		price: number;
		discountPercent: number;
		/** Next invoice after promo code and credit. */
		nextAmount: number;
		/** Next invoice with the commercial discount only. */
		listAmount: number;
		cancelAtPeriodEnd: boolean;
		startedAt: string;
		currentPeriodEnd: string | null;
		plan: { key: string; name: string };
	} | null;
	invoices: Invoice[];
	creditNotes: CreditNote[];
	/** Centimes of credit waiting to be deducted. */
	creditBalance: number;
	promo: { code: string; discountPercent: number; invoicesLeft: number | null } | null;
	/** 0 = automatic suspension off. */
	suspendAfterDays: number;
};

/** "011780000012345678901234" → "011 780 0000123456789012 34" (bank, city, account, key). */
export const formatRib = (rib: string) => rib.replace(/^(\d{3})(\d{3})(\d{16})(\d{2})$/, "$1 $2 $3 $4");
