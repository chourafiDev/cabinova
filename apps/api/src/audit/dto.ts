import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AUDIT_ENTITIES = [
  'patient',
  'appointment',
  'consultation',
] as const;

export class ListAuditLogsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;

  /** Comma-separated: "patient,appointment" */
  @IsOptional()
  @Matches(
    new RegExp(
      `^(${AUDIT_ENTITIES.join('|')})(,(${AUDIT_ENTITIES.join('|')}))*$`,
    ),
  )
  entity?: string;

  /** Matches the acting member's name or e-mail. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Inclusive, UTC day boundaries (the browser sends local midnight as ISO). */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
