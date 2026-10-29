import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Trims strings; empty → null (clears an optional field). */
const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

/** Durations offered when booking (the agenda's list, in minutes). */
export const APPOINTMENT_DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export class UpdateProfileDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Au moins 8 caractères.' })
  @MaxLength(200)
  newPassword: string;
}

export class UpdateAgendaSettingsDto {
  @IsInt()
  @IsIn(APPOINTMENT_DURATIONS)
  defaultAppointmentMinutes: number;
}

/**
 * The cabinet's identity as the clinic may edit it (the form sends every
 * field). Same limits as Super Admin's form, since both write the catalog.
 */
export class UpdateCabinetDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class OpeningHoursDto {
  /** Checked in depth by parseOpeningHours. */
  @IsObject()
  openingHours: Record<string, unknown>;
}
