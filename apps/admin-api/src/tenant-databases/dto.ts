import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProvisionTenantDto {
  /** E-mail the responsible doctor an invitation to choose a password. */
  @IsOptional()
  @IsBoolean()
  sendInvitation = true;
}

/** Permanent deletion: the admin retypes the cabinet's exact name. */
export class DeleteTenantDataDto {
  @IsString()
  @MaxLength(200)
  confirmName: string;
}

export class ComplianceSettingsDto {
  /** Years a closed cabinet's data is kept before it may be deleted. */
  @IsInt()
  @Min(0)
  @Max(50)
  retentionYears: number;
}
