import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
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

class FeatureFieldsDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsIn(STATUSES)
  status: FeatureStatus;

  /** Required when switching a feature off: shown to admins and audited. */
  @ValidateIf((d: FeatureFieldsDto) => d.status === 'disabled')
  @clean()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  disabledReason?: string | null;
}

export class CreateFeatureDto extends FeatureFieldsDto {
  /** Identifier the clinic app checks; immutable. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(_[a-z0-9]+)*$/, {
    message: 'Minuscules, chiffres et _ uniquement.',
  })
  @MaxLength(60)
  key: string;
}

export class UpdateFeatureDto extends FeatureFieldsDto {}

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
