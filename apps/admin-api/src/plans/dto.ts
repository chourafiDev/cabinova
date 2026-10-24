import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { PlanFeatures } from './catalog.js';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/**
 * Everything a plan defines (Module 3): prices, trial, limits, features.
 * The plan form always sends the whole plan, so these are all required;
 * a NULL limit means unlimited.
 */
class PlanFieldsDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description: string | null;

  /** Centimes (MAD). */
  @IsInt()
  @Min(0)
  priceMonthly: number;

  /** Centimes (MAD). */
  @IsInt()
  @Min(0)
  priceAnnual: number;

  @IsInt()
  @Min(0)
  @Max(30)
  trialDays: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDoctors: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSecretaries: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageQuotaMb: number | null;

  /**
   * Level per feature key, e.g. { sms_reminders: "limited" }. Keys are
   * checked against the feature catalog by the service; missing = "none".
   */
  @IsObject()
  features: PlanFeatures;

  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class CreatePlanDto extends PlanFieldsDto {
  /** Stable code identifier, e.g. "pro". Immutable once created. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9]+(_[a-z0-9]+)*$/, {
    message: 'Minuscules, chiffres et _ uniquement.',
  })
  @MaxLength(40)
  key: string;
}

export class UpdatePlanDto extends PlanFieldsDto {
  /** false archives the plan: existing cabinets keep it, new ones can't pick it. */
  @IsBoolean()
  active: boolean;
}

export class ListPlansQuery {
  /** Only plans that can be picked for a new cabinet. */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
}
