import {
  Controller,
  Get,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { MAX_FILE_BYTES } from './ammps-file.js';
import { ListMedicationsQuery } from './dto.js';
import { MedicinesService, type UploadedFile as Upload } from './medicines.service.js';

const FileUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2 },
  defParamCharset: 'utf8',
} as Parameters<typeof FileInterceptor>[1]);

/** The file interceptor, its "too large" worded like our other errors. */
@Injectable()
class AmmpsUpload implements NestInterceptor {
  private readonly inner = new FileUpload();

  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await this.inner.intercept(context, next);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException('Fichier trop volumineux (20 Mo au maximum).');
      }
      throw err;
    }
  }
}

/** Médicaments: the shared AMMPS list, its imports, and a new upload. */
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @RequirePermissions('medicines:read')
  @Get('overview')
  overview() {
    return this.medicines.overview();
  }

  @RequirePermissions('medicines:read')
  @Get('imports')
  imports() {
    return this.medicines.imports();
  }

  @RequirePermissions('medicines:read')
  @Get()
  list(@Query() query: ListMedicationsQuery) {
    return this.medicines.list(query);
  }

  @RequirePermissions('medicines:write')
  @Post('imports')
  @UseInterceptors(AmmpsUpload)
  upload(
    @UploadedFile() file: Upload | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.medicines.upload(file, { userId: user.id, ip: req.ip, name: user.name });
  }
}
