import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsQuery } from './dto.js';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequirePermissions('settings:read')
  @Get()
  list(@Query() query: ListAuditLogsQuery) {
    return this.audit.list(query);
  }
}
