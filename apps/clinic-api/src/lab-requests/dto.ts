import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Editor HTML: generous, the sanitizer keeps only what prints. */
const MAX_BODY = 20_000;

/** A bilan biologique as the doctor writes it. */
export class LabRequestDto {
  @IsUUID()
  patientId: string;

  /** The visit it is written at, if any. */
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}

/** A correction of a saved bilan: its text only. */
export class LabRequestBodyDto {
  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}

/** One of the doctor's own bilans. */
export class LabRequestModelDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(MAX_BODY)
  body: string;
}
