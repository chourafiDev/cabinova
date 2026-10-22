import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PERMISSIONS, type Permission } from '../auth/permissions.js';

export class InviteUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds: string[];
}

export class UpdateStatusDto {
  @IsBoolean()
  active: boolean;
}

class OverrideDto {
  @IsIn(Object.keys(PERMISSIONS))
  permission: Permission;

  @IsIn(['grant', 'deny'])
  effect: 'grant' | 'deny';
}

/** Full replacement of a member's roles and individual exceptions. */
export class UpdateAccessDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideDto)
  overrides: OverrideDto[];
}
