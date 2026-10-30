import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/**
 * Who issues the invoices and where to send the transfer. The RIB (24
 * digits, Moroccan format) is printed on every invoice and e-mail.
 */
export class BillingSettingsDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  /** Identifiant Commun de l'Entreprise (15 chiffres). */
  @clean()
  @IsOptional()
  @Matches(/^\d{15}$/, { message: 'ICE : 15 chiffres.' })
  ice?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  rc?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountHolder: string;

  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName: string;

  /** 24 digits; spaces are accepted and removed. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '') : value,
  )
  @Matches(/^\d{24}$/, { message: 'Le RIB compte 24 chiffres.' })
  rib: string;

  @clean()
  @IsOptional()
  @Matches(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, { message: 'Code SWIFT invalide.' })
  swift?: string;

  /** Days after the period start (or issue) before an unpaid invoice is overdue. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  graceDays: number;

  /** Renewal invoices are issued this many days before the period ends. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  invoiceDaysBefore: number;

  /** "Your trial ends in N days" e-mail; 0 = not sent. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  trialReminderDays: number = 3;

  /**
   * Suspend a cabinet automatically this many days after its invoice became
   * overdue; 0 = never (manual only). A warning is e-mailed 3 days before.
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  suspendAfterDays: number = 0;
}

/** A bank transfer seen on the statement, recorded against an invoice. */
export class RecordPaymentDto {
  /** Centimes received; must cover the invoice. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsISO8601({ strict: true })
  receivedAt: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** The fiche de paiement arrived and the transfer is on the statement. */
export class ConfirmQuoteDto {
  /** Centimes received; must cover the devis (0 for a fully discounted one). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount: number;

  @IsISO8601({ strict: true })
  receivedAt: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListQuotesQuery {
  @IsOptional()
  @IsIn(['pending', 'paid', 'void'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tenantId?: string;
}

export class VoidInvoiceDto {
  @clean()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class ListInvoicesQuery {
  /** "open" = billed + overdue (waiting for a transfer). */
  @IsOptional()
  @IsIn(['open', 'billed', 'overdue', 'paid', 'void'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tenantId?: string;
}

/** Change the plan, billing period or discount of a live subscription. */
export class ChangeSubscriptionDto {
  @IsString()
  @MaxLength(40)
  planKey: string;

  @IsIn(['monthly', 'annual'])
  billingPeriod: 'monthly' | 'annual';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent: number;

  /** Copy the new plan's limits into the cabinet's quotas. */
  @IsBoolean()
  applyQuotas: boolean;
}

/** Give a plan to a cabinet that has none (created before plans, or résilié). */
export class AttachSubscriptionDto extends ChangeSubscriptionDto {
  /** 0 = no trial: the first invoice is issued now. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays: number;
}

export class CancelAtTermDto {
  @IsBoolean()
  cancelAtPeriodEnd: boolean;
}

/** Avoir on a paid invoice: money sent back, or credit for the next invoices. */
export class IssueCreditNoteDto {
  @IsIn(['refund', 'credit'])
  kind: 'refund' | 'credit';

  /** Centimes; at most what was paid and not yet credited. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @clean()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;

  /** Refund: the day the transfer back was sent. */
  @IsOptional()
  @IsISO8601({ strict: true })
  refundedAt?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  refundReference?: string;
}

const upper = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

export class CreatePromoCodeDto {
  @upper()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{2,29}$/, {
    message: 'Code : 3 à 30 lettres, chiffres, - ou _.',
  })
  code: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent: number;

  /** Invoices discounted; omitted = the whole subscription. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  durationInvoices?: number;

  /** Empty = every plan. */
  @IsOptional()
  @IsString({ each: true })
  planKeys?: string[];

  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class ApplyPromoCodeDto {
  @upper()
  @IsString()
  @MaxLength(30)
  code: string;
}
