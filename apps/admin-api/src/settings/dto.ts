import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Configuration globale — one DTO per section. Empty strings become null
// (= "not set"), so a field can be cleared.

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export const TIMEZONES = [
  'Africa/Casablanca',
  'Europe/Paris',
  'Africa/Algiers',
  'Africa/Tunis',
  'Africa/Dakar',
  'Africa/Abidjan',
] as const;
export const LANGUAGES = ['fr', 'ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export class GeneralSettingsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  platformName!: string;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  supportEmail!: string | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(/^[+\d][\d\s.-]{5,20}$/, { message: 'Numéro de téléphone invalide' })
  supportPhone!: string | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  websiteUrl!: string | null;

  @IsIn(TIMEZONES)
  defaultTimezone!: (typeof TIMEZONES)[number];
}

export class EmailSettingsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  senderName!: string;

  /** Must be on a domain verified with the e-mail provider; null = EMAIL_FROM. */
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  senderAddress!: string | null;

  /** Where the cabinets' answers land (e.g. the support mailbox). */
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  replyTo!: string | null;

  /** Plain text added at the bottom of every e-mail. */
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  signature!: string | null;
}

class CabinetNotificationsDto {
  @IsBoolean() trialEnding!: boolean;
  @IsBoolean() invoiceIssued!: boolean;
  @IsBoolean() invoiceOverdue!: boolean;
  @IsBoolean() paymentReceipt!: boolean;
}

class TeamNotificationsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsBoolean() incidents!: boolean;
  @IsBoolean() databaseUnreachable!: boolean;
  @IsBoolean() invoiceOverdue!: boolean;
}

export class NotificationSettingsDto {
  @ValidateNested()
  @Type(() => CabinetNotificationsDto)
  cabinets!: CabinetNotificationsDto;

  @ValidateNested()
  @Type(() => TeamNotificationsDto)
  team!: TeamNotificationsDto;
}

export class LanguageSettingsDto {
  @IsIn(LANGUAGES)
  defaultLanguage!: Language;

  /** Offered to cabinets; always contains the default. */
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(LANGUAGES, { each: true })
  available!: Language[];
}

export class BrandingSettingsDto {
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur au format #RRGGBB' })
  primaryColor!: string;

  /**
   * data:image/(png|jpeg);base64,… up to ~200 KB; null removes it; omitted
   * keeps the current logo. No SVG: it can carry scripts and most mail
   * clients don't show it.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(280_000)
  @Matches(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Logo : image PNG ou JPEG',
  })
  logo?: string | null;
}
