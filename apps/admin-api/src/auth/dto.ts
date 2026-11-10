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

export class TwoFactorChallengeDto {
  @IsString()
  @MaxLength(200)
  challenge: string;

  /** 6-digit code from the app, or a backup code "xxxxx-xxxxx". */
  @IsString()
  @MaxLength(20)
  code: string;
}

export class TwoFactorCodeDto {
  @IsString()
  @MaxLength(20)
  code: string;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
