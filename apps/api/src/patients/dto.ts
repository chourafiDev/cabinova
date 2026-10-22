import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SEXES = ['male', 'female'] as const;
export const COVERAGES = [
  'none',
  'cnss',
  'cnops',
  'amo_tadamon',
  'far',
  'private',
] as const;

/** Trims strings; empty → null (clears an optional field). */
const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/**
 * "06 12-34 56 78" → "0612345678" (keeps a leading +). Input without digits
 * is kept as is so validation rejects it instead of silently clearing it.
 */
const phone = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string' || !value.trim()) return value || null;
    return value.trim().replace(/(?!^\+)\D/g, '') || value;
  });

const PHONE = /^\+?\d{9,15}$/;

/** Create and full update (PUT): the form always sends every field. */
export class PatientDto {
  @clean()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @clean()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @IsIn(SEXES)
  sex: (typeof SEXES)[number];

  @clean()
  @IsOptional()
  @IsISO8601({ strict: true })
  birthDate?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{1,2}\d{1,7}$/, { message: 'CIN invalide' })
  cin?: string | null;

  @phone()
  @IsOptional()
  @Matches(PHONE, { message: 'Téléphone invalide' })
  phone?: string | null;

  @clean()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsIn(COVERAGES)
  coverage?: (typeof COVERAGES)[number];

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  coverageNumber?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  insurer?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @phone()
  @IsOptional()
  @Matches(PHONE, { message: "Téléphone du contact d'urgence invalide" })
  emergencyContactPhone?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export const SORTABLE = [
  'lastName',
  'fileNumber',
  'birthDate',
  'createdAt',
] as const;

export class ListPatientsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;

  /** Name, phone, CIN or file number. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Comma-separated: "male,female" */
  @IsOptional()
  @Matches(/^(male|female)(,(male|female))*$/)
  sex?: string;

  /** Comma-separated: "cnss,cnops" */
  @IsOptional()
  @Matches(new RegExp(`^(${COVERAGES.join('|')})(,(${COVERAGES.join('|')}))*$`))
  coverage?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status: 'active' | 'archived' = 'active';

  /** Inclusive, UTC day boundaries (the browser sends local midnight as ISO). */
  @IsOptional()
  @IsISO8601({ strict: true })
  createdFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  createdTo?: string;

  /** "lastName.asc" */
  @IsOptional()
  @Matches(new RegExp(`^(${SORTABLE.join('|')})\\.(asc|desc)$`))
  sort = 'lastName.asc';
}

/** Selection of the list (bulk export / delete). */
export class PatientIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  ids: string[];
}
