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
