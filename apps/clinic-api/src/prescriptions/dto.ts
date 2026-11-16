import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Trims; empty → null. */
const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

export class PrescriptionItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  medication: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  posology?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string | null;

  /** Where the line was picked from (AMMPS list), if it was. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  ammpsId?: number | null;

  /** …or the doctor's own medicines. */
  @IsOptional()
  @IsUUID()
  customMedicationId?: string | null;
}

/** The whole ordonnance, as the doctor's form sends it on every save. */
export class PrescriptionDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** The ordonnance reworded in the editor (rich text), printed as is; null = the lines. */
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string | null;
}
