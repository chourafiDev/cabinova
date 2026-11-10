import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email: string;
}

/** A code from the authenticator app, or a backup code. */
export class TwoFactorCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}

export class TwoFactorChallengeDto extends TwoFactorCodeDto {
  @IsString()
  @MaxLength(100)
  challenge: string;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
