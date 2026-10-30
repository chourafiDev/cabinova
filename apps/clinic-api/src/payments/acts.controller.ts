import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { Pool } from '@neondatabase/serverless';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertOwner } from '../auth/roles.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ActDto, ActsQuery } from './dto.js';

const COLUMNS = 'id, name, price, active';

/**
 * Tarifs: the cabinet's acts and prices. Everyone reads the active ones
 * (checkout); the owner edits them. An act in use is archived, never deleted.
 */
@Controller('acts')
export class ActsController {
  @Get()
  async list(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() query: ActsQuery,
  ) {
    const all = query.archived && user.role === 'owner';
    const { rows } = await db.query(
      `select ${COLUMNS} from acts ${all ? '' : 'where active'}
        order by active desc, lower(name)`,
    );
    return rows;
  }

  @Activity('act.create', 'act')
  @Post()
  async create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: ActDto,
  ) {
    assertOwner(user);
    return unique(() =>
      db
        .query(
          `insert into acts (name, price) values ($1, $2) returning ${COLUMNS}`,
          [dto.name, dto.price],
        )
        .then((r) => r.rows[0]),
    );
  }

  /** New name or price: past visits keep what they were charged. */
  @Activity('act.update', 'act')
  @Put(':id')
  async update(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActDto,
  ) {
    assertOwner(user);
    return unique(() =>
      setOne(
        db,
        `update acts set name = $2, price = $3, updated_at = now() where id = $1
         returning ${COLUMNS}`,
        [id, dto.name, dto.price],
      ),
    );
  }

  @Activity('act.archive', 'act')
  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    return setOne(
      db,
      `update acts set active = false, updated_at = now() where id = $1 returning ${COLUMNS}`,
      [id],
    );
  }

  @Activity('act.restore', 'act')
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    return unique(() =>
      setOne(
        db,
        `update acts set active = true, updated_at = now() where id = $1 returning ${COLUMNS}`,
        [id],
      ),
    );
  }
}

async function setOne(db: Pool, sql: string, params: unknown[]) {
  const { rows } = await db.query(sql, params);
  if (!rows[0]) {
    throw new NotFoundException({
      code: 'ACT_NOT_FOUND',
      message: 'Acte introuvable.',
    });
  }
  return rows[0];
}

/** Two acts can't share a name (case-insensitive). */
async function unique<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictException({
        code: 'ACT_NAME_TAKEN',
        message: 'Un acte porte déjà ce nom.',
      });
    }
    throw err;
  }
}
