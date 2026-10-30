import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STAFF_ROLES, type StaffRole } from '../auth/roles.js';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** What the owner can change on a member (the e-mail is their login). */
export class UpdateMemberDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsIn(STAFF_ROLES, { message: 'Rôle invalide.' })
  role: StaffRole;

  /** The spaces they work in: at least one. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins un espace.' })
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  spaceIds: string[];
}

export class InviteMemberDto extends UpdateMemberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(200)
  email: string;
}

export class RequireTwoFactorDto {
  @IsBoolean()
  required: boolean;
}
