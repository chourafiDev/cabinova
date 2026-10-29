import { IsOptional, IsUUID, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /reports: the period (days, Moroccan time) and what it covers. */
export class ReportsQuery {
  /** First day, included (default: 29 days before `to`). */
  @IsOptional()
  @Matches(DATE, { message: 'Date invalide (AAAA-MM-JJ).' })
  from?: string;

  /** Last day, included (default: today). */
  @IsOptional()
  @Matches(DATE, { message: 'Date invalide (AAAA-MM-JJ).' })
  to?: string;

  /** One space; every space this person works in when absent. */
  @IsOptional()
  @IsUUID()
  space?: string;

  /** One doctor (doctors may only choose themselves). */
  @IsOptional()
  @IsUUID()
  practitioner?: string;
}
