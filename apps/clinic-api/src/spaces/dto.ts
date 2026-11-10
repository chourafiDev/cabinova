import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const clean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

export class SwitchSpaceDto {
  @IsUUID()
  spaceId: string;
}

export class CreateSpaceDto {
  @clean()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @clean()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/(?!^\+)\D/g, '') || null
      : value,
  )
  @IsOptional()
  @Matches(/^\+?\d{9,15}$/, { message: 'Téléphone invalide' })
  phone?: string | null;
}
