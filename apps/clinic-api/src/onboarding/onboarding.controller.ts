import { Controller, HttpCode, Post } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
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
}
