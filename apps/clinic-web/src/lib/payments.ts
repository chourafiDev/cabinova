// Encaissements (clinic-api src/payments): types, labels and amounts.
// Amounts are integers in centimes of MAD everywhere.

export type PaymentMethod = "cash" | "card" | "cheque" | "transfer";

export const METHODS: { value: PaymentMethod; label: string; reference?: string }[] = [
	{ value: "cash", label: "Espèces" },
	{ value: "card", label: "Carte", reference: "N° de transaction" },
	{ value: "cheque", label: "Chèque", reference: "N° du chèque" },
	{ value: "transfer", label: "Virement", reference: "Référence du virement" },
];
export const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label])) as Record<
	PaymentMethod,
	string
>;

/** The owner's history and closes: periods ending today. */
export const HISTORY_PRESETS = [
	{ key: "jour", label: "Aujourd’hui" },
	{ key: "7j", label: "7 jours" },
	{ key: "30j", label: "30 jours" },
	{ key: "mois", label: "Ce mois-ci" },
] as const;
export type HistoryPreset = (typeof HISTORY_PRESETS)[number]["key"];

/** A price-list act (GET /acts). */
export type Act = { id: string; name: string; price: number; active: boolean };

export type Movement = {
	id: string;
	kind: "payment" | "refund";
	method: PaymentMethod;
	amount: number;
	reference: string | null;
	receiptNumber: string | null;
	reason: string | null;
	receivedAt: string;
	receivedBy: string | null;
	receivedById: string | null;
	cancelledAt: string | null;
	cancelReason: string | null;
	cancelledBy: string | null;
	/** Its day's cash is closed: nothing can change. */
	locked: boolean;
};

export type ChargeItem = { actId: string | null; label: string; unitPrice: number; quantity: number };

/** A visit's account (GET /appointments/:id/account). */
export type Account = {
	appointment: {
		id: string;
		startsAt: string;
		status: string;
		patient: { id: string; firstName: string; lastName: string; fileNumber: number };
		practitioner: { id: string; name: string };
	};
	chargeId: string | null;
	items: (ChargeItem & { id: string })[];
	payments: Movement[];
	total: number;
	paid: number;
	/** Negative: overpaid, to refund. */
	balance: number;
	/** Today's cash is closed in this space. */
	dayClosed: boolean;
};

type DeskPatient = { id: string; firstName: string; lastName: string; fileNumber: number };

/** GET /cashier/today */
export type Desk = {
	day: string;
	closed: { closedAt: string; closedBy: string | null } | null;
	visits: {
		id: string;
		startsAt: string;
		status: string;
		patient: DeskPatient;
		practitioner: string;
		chargeId: string | null;
		total: number | null;
		paid: number;
		balance: number | null;
	}[];
	unpaid: {
		id: string;
		startsAt: string;
		patient: DeskPatient;
		practitioner: string;
		total: number;
		paid: number;
		balance: number;
	}[];
};

/** GET /payments (owner) */
export type History = {
	period: { from: string; to: string };
	totals: {
		received: number;
		refunded: number;
		net: number;
		payments: number;
		cancelled: number;
		byMethod: { method: PaymentMethod; net: number }[];
	};
	outstanding: { amount: number; visits: number };
	payments: (Movement & {
		patient: DeskPatient;
		space: string;
		practitioner: string;
		appointmentId: string;
	})[];
	page: number;
	pageCount: number;
};

/** GET /cashier/closes (owner) */
export type CashClose = {
	id: string;
	day: string;
	space: string;
	expected: Record<PaymentMethod, number>;
	countedCash: number;
	difference: number;
	note: string | null;
	closedBy: string | null;
	closedAt: string;
};

/** GET /patients/:id/account */
export type PatientAccount = {
	visits: {
		appointmentId: string;
		startsAt: string;
		practitioner: string;
		total: number;
		paid: number;
		balance: number;
		acts: string[];
	}[];
	balance: number;
};

/** GET /payments/:id/receipt */
export type Receipt = Movement & {
	total: number;
	space: { name: string; city: string | null; address: string | null; phone: string | null };
	patient: { firstName: string; lastName: string; fileNumber: number; cin: string | null };
	visit: { name: string; startsAt: string };
	items: { label: string; unitPrice: number; quantity: number }[];
	cabinet: {
		name: string;
		legalName: string | null;
		specialty: string | null;
		address: string | null;
		city: string | null;
		phone: string | null;
		email: string;
	};
};

const whole = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 25000 → "250 MAD", 25050 → "250,50 MAD", 125000 → "1.250 MAD" (like the platform). */
export const mad = (centimes: number) =>
	`${(centimes % 100 === 0 ? whole : cents).format(centimes / 100)} MAD`;

/** What an amount field holds, never grouped: 125000 → "1250", 25050 → "250,50". */
export const toInput = (centimes: number) =>
	centimes % 100 === 0 ? String(centimes / 100) : (centimes / 100).toFixed(2).replace(".", ",");

/** "250", "250,50", "1 250.5" → centimes; null when it isn't an amount. */
export function parseMad(value: string) {
	const clean = value.replace(/[\s ]/g, "").replace(",", ".");
	if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
	return Math.round(Number(clean) * 100);
}

const UNITS = [
	"zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
	"onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number): string {
	if (n <= 16) return UNITS[n];
	if (n < 20) return `dix-${UNITS[n - 10]}`;
	if (n < 70) {
		const ten = Math.floor(n / 10);
		const unit = n % 10;
		if (unit === 0) return TENS[ten];
		return unit === 1 ? `${TENS[ten]} et un` : `${TENS[ten]}-${UNITS[unit]}`;
	}
	if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${below100(n - 60)}`;
	if (n === 80) return "quatre-vingts";
	return `quatre-vingt-${below100(n - 80)}`;
}

function below1000(n: number): string {
	const hundreds = Math.floor(n / 100);
	const rest = n % 100;
	const head = hundreds === 0 ? "" : hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest === 0 ? "s" : ""}`;
	if (rest === 0) return head || "zéro";
	return head ? `${head} ${below100(rest)}` : below100(rest);
}

/** 1250 → "mille deux cent cinquante" (whole numbers below a billion). */
export function inWords(n: number): string {
	if (n < 1000) return below1000(n);
	if (n < 1_000_000) {
		const thousands = Math.floor(n / 1000);
		const rest = n % 1000;
		// "deux cents" and "quatre-vingts" lose their s before "mille".
		const head = thousands === 1 ? "mille" : `${below1000(thousands).replace(/(cent|vingt)s$/, "$1")} mille`;
		return rest ? `${head} ${below1000(rest)}` : head;
	}
	const millions = Math.floor(n / 1_000_000);
	const rest = n % 1_000_000;
	const head = `${below1000(millions)} million${millions > 1 ? "s" : ""}`;
	return rest ? `${head} ${inWords(rest)}` : head;
}

/** 25050 → "deux cent cinquante dirhams et cinquante centimes". */
export function madInWords(centimes: number) {
	const dirhams = Math.floor(centimes / 100);
	const cents = centimes % 100;
	const main = `${inWords(dirhams)} dirham${dirhams > 1 ? "s" : ""}`;
	return cents ? `${main} et ${inWords(cents)} centime${cents > 1 ? "s" : ""}` : main;
}
