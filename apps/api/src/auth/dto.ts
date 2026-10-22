import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
