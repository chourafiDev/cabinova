import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertMedical } from '../auth/roles.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';

/** The consultation fields a phrase can go into. */
const FIELDS = [
  'complaint',
  'history',
  'examination',
  'diagnosis',
  'plan',
] as const;

class PhraseDto {
  @IsIn(FIELDS)
  field: (typeof FIELDS)[number];

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

const PHRASE = `id, field, text, created_at as "createdAt"`;

/** A doctor's own saved phrases (Modèles): only they see and change them. */
@Controller('phrases')
export class PhrasesController {
  @Get()
  async list(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    const { rows } = await db.query(
      `select ${PHRASE} from phrases where user_id = $1 order by field, text`,
      [user.id],
    );
    return rows;
  }

  @Post()
  async create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: PhraseDto,
  ) {
    assertMedical(user);
    const { rows } = await db.query(
      `insert into phrases (user_id, field, text) values ($1, $2, $3) returning ${PHRASE}`,
      [user.id, dto.field, dto.text],
    );
    return rows[0];
  }

  @Delete(':id')
  async remove(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    const { rowCount } = await db.query(
      'delete from phrases where id = $1 and user_id = $2',
      [id, user.id],
    );
    if (!rowCount) {
      throw new NotFoundException({
        code: 'PHRASE_NOT_FOUND',
        message: 'Phrase introuvable.',
      });
    }
    return { id };
  }
}
