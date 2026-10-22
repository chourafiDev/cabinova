import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that free the slot (another appointment can take it). */
export const RELEASED_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show'];

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** Create and full update (also used by drag & drop in the agenda). */
export class AppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  practitionerId: string;

  @IsISO8601({ strict: true })
  startsAt: string;

  @IsISO8601({ strict: true })
  endsAt: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateStatusDto {
  @IsIn(APPOINTMENT_STATUSES)
  status: AppointmentStatus;
}

export class ListAppointmentsQuery {
  /** Range overlapping [from, to). Optional only with `patientId` (full history). */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  includeCancelled = false;
}
