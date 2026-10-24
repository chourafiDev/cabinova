import { IsBoolean, IsOptional } from 'class-validator';

export class ProvisionTenantDto {
  /** E-mail the responsible doctor an invitation to choose a password. */
  @IsOptional()
  @IsBoolean()
  sendInvitation = true;
}
