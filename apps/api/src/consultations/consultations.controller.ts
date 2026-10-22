import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { ConsultationsService } from './consultations.service.js';
import {
  ConsultationDto,
  ListConsultationsQuery,
  MedicalProfileDto,
  StartConsultationDto,
} from './dto.js';

@Controller()
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @RequirePermissions('emr:read')
  @Get('consultations')
  list(@Query() query: ListConsultationsQuery) {
    return this.consultations.list(query);
  }

  @RequirePermissions('emr:read')
  @Get('consultations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.consultations.get(user, id);
  }

  /** 201 for a new draft, 200 when the appointment already had one. */
  @RequirePermissions('emr:write')
  @Post('consultations')
  async start(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConsultationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.consultations.start(user, dto);
    res.status(result.created ? 201 : 200);
    return { id: result.id };
  }

  @RequirePermissions('emr:write')
  @Put('consultations/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultationDto,
  ) {
    return this.consultations.update(user, id, dto);
  }

  @RequirePermissions('emr:write')
  @Post('consultations/:id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consultations.complete(user, id);
  }

  @RequirePermissions('emr:read')
  @Get('patients/:id/medical-profile')
  getProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consultations.getProfile(user, id);
  }

  @RequirePermissions('emr:write')
  @Put('patients/:id/medical-profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MedicalProfileDto,
  ) {
    return this.consultations.updateProfile(user, id, dto);
  }
}
