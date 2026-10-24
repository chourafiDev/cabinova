import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const STATUSES =
  /^(pending|provisioning|active|suspended|closure_pending|closed)(,(pending|provisioning|active|suspended|closure_pending|closed))*$/;

/**
 * Module 1 filters. They select a set of cabinets (by creation period,
 * status, city, specialty, plan); every figure is computed over that set.
 * Alerts stay platform-wide so a filter never hides an incident.
 */
export class DashboardQuery {
  /** Created on or after (yyyy-mm-dd). */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Created on or before (yyyy-mm-dd, inclusive). */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @Matches(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  /** Comma-separated plan keys; "none" = cabinets without a plan. */
  @IsOptional()
  @Matches(/^[a-z0-9_]+(,[a-z0-9_]+)*$/)
  plan?: string;
}
