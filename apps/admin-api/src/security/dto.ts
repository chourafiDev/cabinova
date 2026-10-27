import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUDIT_CATEGORIES } from './catalog.js';

export class AuditQuery {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Inclusive day (yyyy-mm-dd). */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(Object.keys(AUDIT_CATEGORIES))
  category?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  sensitive?: boolean;

  /** Matches the action, the actor, the cabinet or the details. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 50;
}
