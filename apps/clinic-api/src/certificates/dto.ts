import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CERTIFICATE_KINDS = ['day', 'period'] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

/** Editor HTML: generous, the sanitizer keeps only what prints. */
const MAX_BODY = 20_000;

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** A certificate as the doctor gives it: never edited afterwards. */
export class CertificateDto {
  @IsUUID()
  patientId: string;

  /** The visit it is written at, if any. */
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsIn(CERTIFICATE_KINDS)
  kind: CertificateKind;

  /** "YYYY-MM-DD": the day, or the first day of the period. */
  @IsISO8601({ strict: true })
  startsOn: string;

  /** "YYYY-MM-DD", last day of the period (inclusive). */
  @IsOptional()
  @IsISO8601({ strict: true })
  endsOn?: string | null;

  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}

/** One of the doctor's own models. */
export class CertificateModelDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}
