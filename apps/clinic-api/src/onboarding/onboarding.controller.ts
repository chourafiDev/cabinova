import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** The tour was finished or skipped: don't start it again on sign-in. */
  @Post('tour')
  @HttpCode(204)
  async completeTour(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    await this.onboarding.completeTour(db, user.id);
  }

  @Get('checklist')
  async checklist(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return { steps: await this.onboarding.checklist(db, user) };
  }

  /** "C'est bon": the default hours suit the cabinet. */
  @Post('checklist/hours')
  @HttpCode(204)
  async confirmHours(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    assertOwner(user);
    await this.onboarding.confirmHours(db);
  }

  @Post('checklist/dismiss')
  @HttpCode(204)
  async dismiss(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    assertOwner(user);
    await this.onboarding.dismissChecklist(db);
  }
}
