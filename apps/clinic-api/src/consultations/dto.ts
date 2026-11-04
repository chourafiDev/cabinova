import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** An empty field is no value; numbers may arrive as text from the form. */
const num = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === null || value === undefined
      ? null
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : value,
  );

/** The whole consultation, as the doctor's form sends it on every save. */
export class ConsultationDto {
  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  complaint?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  history?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  examination?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  diagnosis?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  plan?: string | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  systolic?: number | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  diastolic?: number | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  heartRate?: number | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  spo2?: number | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  heightCm?: number | null;

  @num()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(45)
  temperature?: number | null;

  @num()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(400)
  weightKg?: number | null;

  @num()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.2)
  @Max(10)
  glycemia?: number | null;
}

/** The text and number fields, in the table's column order. */
export const CONSULTATION_FIELDS = [
  ['complaint', 'complaint'],
  ['history', 'history'],
  ['examination', 'examination'],
  ['diagnosis', 'diagnosis'],
  ['plan', 'plan'],
  ['systolic', 'systolic'],
  ['diastolic', 'diastolic'],
  ['heart_rate', 'heartRate'],
  ['spo2', 'spo2'],
  ['height_cm', 'heightCm'],
  ['temperature', 'temperature'],
  ['weight_kg', 'weightKg'],
  ['glycemia', 'glycemia'],
] as const satisfies readonly (readonly [string, keyof ConsultationDto])[];
