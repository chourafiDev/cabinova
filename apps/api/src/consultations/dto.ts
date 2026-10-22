import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** Empty input → null; numbers kept as numbers. */
const num = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === undefined ? null : value,
  );

const LONG = 10_000;

export class StartConsultationDto {
  @IsUUID()
  patientId: string;

  /** Started from the agenda: links the consultation to the appointment. */
  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}

/** Full update of a draft (the editor always sends every field). */
export class ConsultationDto {
  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  history?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  examination?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  diagnosis?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  plan?: string | null;

  // Plausibility bounds: catch typos (75 kg typed 750), not clinical judgement.
  @num()
  @IsOptional()
  @IsNumber()
  @Min(0.3)
  @Max(400)
  weightKg?: number | null;

  @num()
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(260)
  heightCm?: number | null;

  @num()
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperatureC?: number | null;

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
  @Max(260)
  heartRate?: number | null;

  @num()
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  spo2?: number | null;

  @num()
  @IsOptional()
  @IsNumber()
  @Min(0.2)
  @Max(10)
  glycemia?: number | null;
}

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

export class MedicalProfileDto {
  @clean()
  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: (typeof BLOOD_GROUPS)[number] | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  allergies?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  chronicConditions?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  medicalHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  surgicalHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  familyHistory?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  currentTreatments?: string | null;
}

export const CONSULTATION_SORTABLE = ['startedAt'] as const;

export class ListConsultationsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;

  /** Patient name or file number. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^(draft|completed)(,(draft|completed))*$/)
  status?: string;

  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsIn(['startedAt.asc', 'startedAt.desc'])
  sort = 'startedAt.desc';
}
