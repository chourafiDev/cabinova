import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const LETTER_KINDS = ['letter', 'report'] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];

/** Editor HTML: generous, the sanitizer keeps only what prints. */
const MAX_BODY = 20_000;

/** A letter as the doctor writes it. */
export class LetterDto {
  @IsUUID()
  patientId: string;

  /** The visit it is written at, if any. */
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  /** A letter (default) or a compte rendu. */
  @IsOptional()
  @IsIn(LETTER_KINDS)
  kind?: LetterKind;

  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}

/** The list asked for: letters (default) or comptes rendus. */
export class LettersQuery {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsIn(LETTER_KINDS)
  kind?: LetterKind;
}

/** A correction of a saved letter: its text only. */
export class LetterBodyDto {
  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}
