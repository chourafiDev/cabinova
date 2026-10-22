import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/**
 * Module 2, Scenario A. `planKey`/feature options are intentionally absent:
 * there is no subscription-plan catalog yet (Module 3), so a cabinet is
 * created without one and a plan is attached once that module exists.
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

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDoctors?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;
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

  @IsOptional()
  @IsIn(['name.asc', 'name.desc', 'createdAt.asc', 'createdAt.desc'])
  sort = 'createdAt.desc';
}
