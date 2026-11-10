// The cabinet's documents from Cabinova (clinic-api billing/quotes.service.ts).

type Party = {
	cabinet: {
		name: string;
		legalName: string | null;
		responsibleName: string;
		address: string | null;
		city: string | null;
		email: string;
	};
	issuer: {
		companyName: string | null;
		address: string | null;
		email: string | null;
		ice: string | null;
		rc: string | null;
		taxId: string | null;
		accountHolder: string | null;
		bankName: string | null;
		rib: string;
		swift: string | null;
	} | null;
	proofEmail: string | null;
};

export type QuoteDocument = Party & {
	id: string;
	number: string;
	description: string;
	/** Centimes. */
	amount: number;
	status: "pending" | "paid" | "void";
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	invoiceId: string | null;
};

export type InvoiceDocument = Party & {
	id: string;
	number: string;
	description: string;
	/** Centimes, after any avoir. */
	amount: number;
	creditApplied: number;
	status: "billed" | "overdue" | "paid" | "void" | "refunded";
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	payments: { id: string; amount: number; receivedAt: string; reference: string | null }[];
};

/** "000000000000000000000000" → "000 000 0000000000000000 00" (Moroccan RIB layout). */
export const formatRib = (rib: string) => rib.replace(/^(\d{3})(\d{3})(\d{16})(\d{2})$/, "$1 $2 $3 $4");
