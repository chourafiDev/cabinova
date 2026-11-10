import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const CLOSURE_KINDS = [
  'vacation',
  'day_off',
  'training',
  'sick',
  'other',
] as const;
export type ClosureKind = (typeof CLOSURE_KINDS)[number];

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** Whole days, both included ("YYYY-MM-DD"). No practitioner: the whole cabinet. */
export class ClosureDto {
  @Transform(({ value }: { value: unknown }) => value || null)
  @IsOptional()
  @IsUUID()
  practitionerId?: string | null;

  @IsIn(CLOSURE_KINDS)
  kind: ClosureKind;

  @IsISO8601({ strict: true })
  startsOn: string;

  @IsISO8601({ strict: true })
  endsOn: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ListClosuresQuery {
  /** "upcoming" (default: not over yet) or "past"; or a range (from, to) for the agenda. */
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  when?: 'upcoming' | 'past';

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class ConflictsQuery {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;

  @Transform(({ value }: { value: unknown }) => value || undefined)
  @IsOptional()
  @IsUUID()
  practitionerId?: string;
}
