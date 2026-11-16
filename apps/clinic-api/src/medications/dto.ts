import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Trims; empty → null (meaning "as the AMMPS says"). */
const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

export class SearchMedicationsQuery {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q: string;
}

/** A doctor's take on an AMMPS medicine; a field left out is kept as it was. */
export class OverrideDto {
  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customName?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customDosage?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultPosology?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDuration?: string | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

export class CustomMedicationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  substances?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  form?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  presentation?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultPosology?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDuration?: string | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

/** Same fields, all optional: only what is sent changes. */
export class UpdateCustomMedicationDto extends CustomMedicationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare name: string;
}

export class RenewalLineDto {
  @IsString()
  @MaxLength(300)
  medication: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  ammpsId?: number | null;

  @IsOptional()
  @IsUUID()
  customMedicationId?: string | null;
}

/** The lines of an old ordonnance about to be renewed. */
export class RenewalCheckDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RenewalLineDto)
  items: RenewalLineDto[];
}
