import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators.js';
import { DatabaseService } from '../database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    await this.database.db.execute(sql`select 1`);
    return { status: 'ok' };
  }
}
