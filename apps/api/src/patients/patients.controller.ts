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
import { ListPatientsQuery, PatientDto, PatientIdsDto } from './dto.js';
import { PatientsService } from './patients.service.js';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @RequirePermissions('patients:read')
  @Get()
  list(@Query() query: ListPatientsQuery) {
    return this.patients.list(query);
  }

  /** CSV download of the selected files. */
  @RequirePermissions('patients:read')
  @Post('export')
  @HttpCode(200)
  async export(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatientIdsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.patients.export(user, dto.ids);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="patients-${date}.csv"`,
    );
    return csv;
  }

  /** Deletes the selected files that have no appointment nor consultation. */
  @RequirePermissions('patients:delete')
  @Post('bulk-delete')
  @HttpCode(200)
  bulkDelete(@CurrentUser() user: AuthUser, @Body() dto: PatientIdsDto) {
    return this.patients.bulkDelete(user, dto.ids);
  }

  @RequirePermissions('patients:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.patients.get(id);
  }

  @RequirePermissions('patients:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: PatientDto) {
    return this.patients.create(user, dto);
  }

  @RequirePermissions('patients:write')
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatientDto,
  ) {
    return this.patients.update(user, id, dto);
  }

  @RequirePermissions('patients:write')
  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.setArchived(user, id, true);
  }

  @RequirePermissions('patients:write')
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.setArchived(user, id, false);
  }
}
