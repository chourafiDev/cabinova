import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { FEATURE_LEVELS, type FeatureLevel } from '../plans/catalog.js';
import type { FeatureStatus } from './resolve.js';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

const STATUSES: FeatureStatus[] = ['active', 'beta', 'disabled'];

/**
 * What the admin controls on a feature: its status. Name, category,
 * description and order come from the code registry (@cabinova/features).
 */
export class UpdateFeatureDto {
  @IsIn(STATUSES)
  status: FeatureStatus;

  /** Required when switching a feature off: shown to admins and audited. */
  @ValidateIf((d: UpdateFeatureDto) => d.status === 'disabled')
  @clean()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  disabledReason?: string | null;
}

/** One cabinet's exception: a level, optionally for a period. */
export class SetOverrideDto {
  @IsIn(FEATURE_LEVELS)
  level: FeatureLevel;

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  endsAt?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
