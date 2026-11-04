import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
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
}
