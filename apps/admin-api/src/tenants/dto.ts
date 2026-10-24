import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
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
  ValidateIf,
} from 'class-validator';
import { MANUAL_TRANSITIONS, type TenantTransition } from './lifecycle.js';

export const BILLING_PERIODS = ['monthly', 'annual'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/**
 * Module 2, Scenario A. The plan (Module 3) supplies the trial length and
 * quotas; any value sent here overrides the plan's for this cabinet
 * (null = unlimited, omitted = the plan's).
 */
export class CreateTenantDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  responsibleName: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @clean()
  @IsEmail()
  @MaxLength(200)
  email: string;

  /** Desired subdomain, e.g. "clinique-rabat" → clinique-rabat.cabinova.ma */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Minuscules, chiffres et tirets uniquement.',
  })
  @MinLength(2)
  @MaxLength(63)
  subdomain: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  trialStartsAt?: string;

  /** Plan key, e.g. "pro". Must be an active plan. */
  @IsString()
  @MaxLength(40)
  planKey: string;

  @IsOptional()
  @IsIn(BILLING_PERIODS)
  billingPeriod: BillingPeriod = 'monthly';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDoctors?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSecretaries?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageQuotaMb?: number | null;
}

/** "" clears an optional field (→ NULL); undefined leaves it unchanged. */
const nullable = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** Required column: may be omitted, never cleared. */
const present = () => ValidateIf((_, value) => value !== undefined);

/**
 * Module 2, Scenario B — administrative details and quotas. Every field is
 * optional; only the ones sent are changed, and the diff is audited. The
 * slug and subdomain are not editable here (routing, Module 4).
 */
export class UpdateTenantDto {
  @clean()
  @present()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @nullable()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @clean()
  @present()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  responsibleName?: string;

  @nullable()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string | null;

  @nullable()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @nullable()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @nullable()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @clean()
  @present()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  /** null = no limit. */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDoctors?: number | null;

  /** null = no limit. */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxSecretaries?: number | null;

  /** null = no limit. */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number | null;

  /** null = no limit. */
  @IsOptional()
  @IsInt()
  @Min(0)
  storageQuotaMb?: number | null;
}

/** Module 2, Scenarios C and D — suspend, reactivate, start closure, close. */
export class ChangeTenantStatusDto {
  @IsIn(MANUAL_TRANSITIONS)
  action: TenantTransition;

  /** Must belong to the transition's catalog (checked in the service). */
  @IsString()
  @MaxLength(40)
  reason: string;

  @clean()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comment: string;

  /** Omitted or not in the future → applied now; otherwise scheduled. */
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveAt?: string;

  @IsOptional()
  @IsBoolean()
  notifyResponsible = true;

  /**
   * Required for `close`: the admin confirms the data export was prepared
   * and retention obligations were checked (Scenario D).
   */
  @ValidateIf((dto: ChangeTenantStatusDto) => dto.action === 'close')
  @Equals(true, {
    message:
      "Confirmez l'export des données et les obligations de conservation.",
  })
  retentionConfirmed?: boolean;
}

export class ListTenantAuditQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;
}

export const TENANT_SORTABLE = ['name', 'createdAt'] as const;

export class ListTenantsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;

  /** Cabinet name, responsible doctor or e-mail. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Comma-separated: "active,suspended" */
  @IsOptional()
  @Matches(
    /^(pending|provisioning|active|suspended|closure_pending|closed)(,(pending|provisioning|active|suspended|closure_pending|closed))*$/,
  )
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  /** Comma-separated plan keys: "starter,pro" */
  @IsOptional()
  @Matches(/^[a-z0-9_]+(,[a-z0-9_]+)*$/)
  plan?: string;

  @IsOptional()
  @IsIn(['name.asc', 'name.desc', 'createdAt.asc', 'createdAt.desc'])
  sort = 'createdAt.desc';
}
