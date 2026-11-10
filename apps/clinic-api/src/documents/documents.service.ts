import { randomUUID } from 'node:crypto';
import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import type { DocumentDto } from './dto.js';
import { StorageService } from './storage.service.js';

/** Scans and phone photos; bigger files are usually a mistake (a video…). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * What a file is, from its first bytes rather than what the browser says:
 * only these are kept, and they are what the browser shows inline.
 */
export function detectType(file: Buffer) {
  const ascii = (from: number, to: number) =>
    file.subarray(from, to).toString('latin1');
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff)
    return 'image/jpeg';
  if (file.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** The name as shown: no folders, no control characters, not endless. */
export function cleanName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? '';
  // oxlint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(-200) || 'document';
}

const DOCUMENT = `
  d.id, d.category, d.name, d.content_type as "contentType", d.size,
  d.created_at as "createdAt", d.uploaded_by as "uploadedById",
  u.name as "uploadedBy"`;

/** The part of multer's file this uses (its own types aren't loaded here). */
export type UploadedDocument = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

type Stored = {
  storageKey: string;
  name: string;
  contentType: string;
  uploadedById: string | null;
};

/**
 * A patient's documents (analyses, radios, papers…), uploaded at the
 * reception or by a doctor, seen by the space's whole team. Deleted by the
 * person who uploaded it, or the responsible doctor.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly storage: StorageService) {}

  async list(db: Pool, spaceId: string, patientId: string) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${DOCUMENT}
         from patient_documents d left join users u on u.id = d.uploaded_by
        where d.patient_id = $1
        order by d.created_at desc`,
      [patientId],
    );
    return rows;
  }

  async upload(
    { tenant, db }: ClinicContext,
    spaceId: string,
    patientId: string,
    file: UploadedDocument | undefined,
    dto: DocumentDto,
    userId: string,
  ) {
    const patient = await this.patient(db, spaceId, patientId);
    if (patient.archived) {
      throw new ConflictException({
        code: 'PATIENT_ARCHIVED',
        message: 'Ce dossier est archivé.',
      });
    }
    if (!file?.size) {
      throw new BadRequestException({
        code: 'DOCUMENT_MISSING',
        message: 'Choisissez un fichier.',
      });
    }
    const contentType = detectType(file.buffer);
    if (!contentType) {
      throw new BadRequestException({
        code: 'DOCUMENT_TYPE',
        message: 'Seuls les PDF et les images (JPEG, PNG, WebP) sont acceptés.',
      });
    }

    const id = randomUUID();
    const key = `cabinets/${tenant.id}/patients/${patientId}/${id}`;
    await this.storage.put(key, file.buffer, contentType);
    try {
      await db.query(
        `insert into patient_documents
           (id, patient_id, category, name, content_type, size, storage_key, uploaded_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          patientId,
          dto.category ?? 'other',
          cleanName(file.originalname),
          contentType,
          file.size,
          key,
          userId,
        ],
      );
    } catch (err) {
      // No row, no file: what isn't listed can't be found again.
      await this.storage.remove(key).catch(() => undefined);
      throw err;
    }
    return this.one(db, spaceId, patientId, id);
  }

  /** The file, for the browser to show or save. */
  async file(db: Pool, spaceId: string, patientId: string, id: string) {
    const doc = await this.stored(db, spaceId, patientId, id);
    return { ...doc, body: await this.storage.get(doc.storageKey) };
  }

  async remove(
    db: Pool,
    spaceId: string,
    patientId: string,
    id: string,
    user: ClinicUser,
  ) {
    const doc = await this.stored(db, spaceId, patientId, id);
    if (user.role !== 'owner' && doc.uploadedById !== user.id) {
      throw new ForbiddenException({
        code: 'DOCUMENT_NOT_YOURS',
        message:
          'Seuls la personne qui l’a ajouté et le médecin responsable peuvent supprimer ce document.',
      });
    }
    // The file first: a row left behind would point at nothing.
    await this.storage.remove(doc.storageKey);
    await db.query('delete from patient_documents where id = $1', [id]);
    this.logger.log(`Document ${id} deleted by ${user.id}`);
  }

  private async one(db: Pool, spaceId: string, patientId: string, id: string) {
    const { rows } = await db.query(
      `select ${DOCUMENT}
         from patient_documents d
         join patients p on p.id = d.patient_id
         left join users u on u.id = d.uploaded_by
        where d.id = $1 and d.patient_id = $2 and p.space_id = $3`,
      [id, patientId, spaceId],
    );
    if (!rows[0]) throw this.notFound();
    return rows[0];
  }

  private async stored(
    db: Pool,
    spaceId: string,
    patientId: string,
    id: string,
  ) {
    const { rows } = await db.query<Stored>(
      `select d.storage_key as "storageKey", d.name, d.content_type as "contentType",
              d.uploaded_by as "uploadedById"
         from patient_documents d join patients p on p.id = d.patient_id
        where d.id = $1 and d.patient_id = $2 and p.space_id = $3`,
      [id, patientId, spaceId],
    );
    if (!rows[0]) throw this.notFound();
    return rows[0];
  }

  private async patient(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query<{ archived: boolean }>(
      `select archived_at is not null as archived
         from patients where id = $1 and space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient introuvable.',
      });
    }
    return rows[0];
  }

  private notFound() {
    return new NotFoundException({
      code: 'DOCUMENT_NOT_FOUND',
      message: 'Document introuvable.',
    });
  }
}
