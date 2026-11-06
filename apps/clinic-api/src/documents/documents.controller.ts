import {
  Body,
  type CallHandler,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  type NestInterceptor,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import {
  DocumentsService,
  MAX_DOCUMENT_BYTES,
  type UploadedDocument,
} from './documents.service.js';
import { DocumentDto } from './dto.js';

const FileUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 5 },
  // File names with accents ("Échographie.pdf") arrive as UTF-8.
  defParamCharset: 'utf8',
} as Parameters<typeof FileInterceptor>[1]);

/** The file interceptor, its "too large" worded like our other errors. */
@Injectable()
class DocumentUpload implements NestInterceptor {
  private readonly inner = new FileUpload();

  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await this.inner.intercept(context, next);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException({
          code: 'DOCUMENT_TOO_LARGE',
          message: 'Le fichier dépasse 10 Mo.',
        });
      }
      throw err;
    }
  }
}

/** A patient's documents, for the space's whole team. */
@UseGuards(SpaceGuard)
@Controller('patients/:patientId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.documents.list(db, space.id, patientId);
  }

  @Activity('document.upload', 'document')
  @Post()
  @UseInterceptors(DocumentUpload)
  upload(
    @Clinic() clinic: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() dto: DocumentDto,
  ) {
    return this.documents.upload(
      clinic,
      space.id,
      patientId,
      file,
      dto,
      user.id,
    );
  }

  /** Shown in the browser (PDF, image), or saved with ?download=1. */
  @Get(':id/file')
  async file(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const doc = await this.documents.file(db, space.id, patientId, id);
    const disposition = res.req.query.download ? 'attachment' : 'inline';
    res.set({
      'Content-Type': doc.contentType,
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      'Cache-Control': 'private, no-store',
    });
    // Helmet's object-src 'none' can stop the browser's PDF viewer. The file
    // is a PDF or an image, checked from its bytes, and nosniff stays.
    res.removeHeader('Content-Security-Policy');
    doc.body.on('error', () => res.destroy()).pipe(res);
  }

  @Activity('document.delete', 'document')
  @Delete(':id')
  @HttpCode(204)
  remove(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.remove(db, space.id, patientId, id, user);
  }
}
