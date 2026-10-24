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
	  }
	| { configured: false; graceDays: number; invoiceDaysBefore: number };

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
};

export type TenantBilling = {
	subscription: {
		id: string;
		status: "trialing" | "active" | "past_due" | "cancelled";
		billingPeriod: "monthly" | "annual";
		price: number;
		discountPercent: number;
		nextAmount: number;
		cancelAtPeriodEnd: boolean;
		startedAt: string;
		currentPeriodEnd: string | null;
		plan: { key: string; name: string };
	} | null;
	invoices: Invoice[];
};

/** "011780000012345678901234" → "011 780 0000123456789012 34" (bank, city, account, key). */
export const formatRib = (rib: string) => rib.replace(/^(\d{3})(\d{3})(\d{16})(\d{2})$/, "$1 $2 $3 $4");
