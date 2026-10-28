import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
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
export const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
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
  @Matches(/^[A-Z]{1,2}\d{1,7}$/, { message: 'CIN invalide (ex. AB123456)' })
  cin?: string | null;

  @phone()
  @IsOptional()
  @Matches(PHONE, { message: 'Téléphone invalide' })
  phone?: string | null;

  @clean()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail invalide' })
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

  @IsOptional()
  @IsIn(['active', 'archived'])
  status: 'active' | 'archived' = 'active';

  /** "lastName.asc" */
  @IsOptional()
  @Matches(new RegExp(`^(${SORTABLE.join('|')})\\.(asc|desc)$`))
  sort = 'lastName.asc';
}

/** Antécédents (doctors only). Every field is sent; empty clears it. */
export class MedicalProfileDto {
  @Transform(({ value }: { value: unknown }) => value || null)
  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: (typeof BLOOD_GROUPS)[number] | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  allergies?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  chronicConditions?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medicalHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  surgicalHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  familyHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  currentTreatments?: string | null;
}
