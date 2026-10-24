import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PLATFORM_PERMISSIONS } from '../auth/permissions.js';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

const PERMISSION_KEYS = Object.keys(PLATFORM_PERMISSIONS);

/** Invite a central user (Module 5): they choose their password from the link. */
export class InvitePlatformUserDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email: string;

  /** Role keys, e.g. ["support_agent"]. At least one. */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  roleKeys: string[];
}

export class UpdatePlatformUserDto {
  @clean()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  roleKeys?: string[];

  /**
   * Per-user exceptions to the roles: { "billing:read": "grant" }. The map
   * replaces the previous one; a permission left out inherits from roles.
   */
  @IsOptional()
  @IsObject()
  overrides?: Record<string, 'grant' | 'deny'>;
}

export class ListPlatformUsersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'invited', 'disabled'])
  status?: 'active' | 'invited' | 'disabled';
}

/** Only the permissions of Agent de Support / Agent technique can change. */
export class UpdatePlatformRoleDto {
  @IsArray()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions: string[];
}
