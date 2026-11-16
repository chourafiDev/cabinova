import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  medicationImports,
  medications,
} from '@cabinova/medicines-db/schema';
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import { DatabaseService } from '../database/database.module.js';
import { AmmpsFileError, readAmmpsFile } from './ammps-file.js';
import { ImportBusyError, importAmmps } from './ammps-import.js';
import type { ListMedicationsQuery } from './dto.js';
import { MedicinesDbService } from './medicines-db.module.js';

const PAGE_SIZE = 25;
/** How many unreadable lines an upload's answer lists. */
const SKIPPED_SHOWN = 20;

/** What an upload brings, from multer (its own types aren't loaded here). */
export type UploadedFile = { buffer: Buffer; originalname: string; size: number };

/** The shared AMMPS medicines list, as the Super Admin manages it. */
@Injectable()
export class MedicinesService {
  constructor(
    private readonly medicines: MedicinesDbService,
    private readonly platform: DatabaseService,
  ) {}

  /** Where the list stands: counts, the last import, one running. */
  async overview() {
    if (!this.medicines.configured) return { configured: false as const };
    const db = this.medicines.db;
    const [counts, [last], [running]] = await Promise.all([
      db
        .select({
          availability: medications.availability,
          isActive: medications.isActive,
          total: count(),
          withPrice: count(medications.ppv),
        })
        .from(medications)
        .groupBy(medications.availability, medications.isActive),
      db
        .select()
        .from(medicationImports)
        .where(eq(medicationImports.status, 'success'))
        .orderBy(desc(medicationImports.startedAt))
        .limit(1),
      db
        .select()
        .from(medicationImports)
        .where(eq(medicationImports.status, 'running'))
        .limit(1),
    ]);
    const active = counts.filter((c) => c.isActive);
    const sum = (rows: typeof counts) => rows.reduce((n, c) => n + c.total, 0);
    return {
      configured: true as const,
      active: sum(active),
      inactive: sum(counts.filter((c) => !c.isActive)),
      withPrice: active.reduce((n, c) => n + c.withPrice, 0),
      byAvailability: {
        marketed: sum(active.filter((c) => c.availability === 'marketed')),
        not_marketed: sum(active.filter((c) => c.availability === 'not_marketed')),
        withdrawn: sum(active.filter((c) => c.availability === 'withdrawn')),
      },
      lastImport: last ?? null,
      running: running ?? null,
    };
  }

  /** The imports, newest first. */
  imports() {
    return this.medicines.db
      .select()
      .from(medicationImports)
      .orderBy(desc(medicationImports.startedAt))
      .limit(30);
  }

  /** The list itself, searched by brand or substance, a page at a time. */
  async list({ q, availability, page = 1 }: ListMedicationsQuery) {
    const db = this.medicines.db;
    const filters: (SQL | undefined)[] = [];
    const term = q?.trim();
    if (term) {
      // "%" and "_" typed by the admin are searched for, not wildcards.
      const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(or(ilike(medications.name, like), ilike(medications.substances, like)));
    }
    if (availability === 'inactive') filters.push(eq(medications.isActive, false));
    else if (availability) {
      filters.push(eq(medications.isActive, true), eq(medications.availability, availability));
    }
    const where = and(...filters);
    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(medications)
        .where(where)
        .orderBy(asc(medications.name), asc(medications.dosage), asc(medications.ammpsId))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(medications).where(where),
    ]);
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  /**
   * Imports an uploaded AMMPS export: read, applied all or nothing (or
   * refused by the safety rules), and audited either way.
   */
  async upload(file: UploadedFile | undefined, actor: AuditActor & { name: string }) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Le fichier doit être un export Excel (.xlsx).');
    }
    let parsed;
    try {
      parsed = readAmmpsFile(file.buffer);
    } catch (err) {
      if (err instanceof AmmpsFileError) throw new BadRequestException(err.message);
      throw err;
    }
    let run;
    try {
      run = await importAmmps(this.medicines.db, {
        file: parsed,
        fileName: file.originalname,
        by: actor.userId ? { id: actor.userId, name: actor.name } : undefined,
      });
    } catch (err) {
      if (err instanceof ImportBusyError) throw new ConflictException(err.message);
      throw err;
    }
    await writeAudit(this.platform.db, actor, {
      action: run.status === 'success' ? 'medicines.import' : 'medicines.import_refused',
      entity: 'medication_import',
      entityId: run.id,
      metadata: {
        fileName: run.fileName,
        rowsRead: run.rowsRead,
        rowsInserted: run.rowsInserted,
        rowsUpdated: run.rowsUpdated,
        rowsDeactivated: run.rowsDeactivated,
        ...(run.error && { error: run.error }),
      },
    });
    return {
      import: run,
      skipped: parsed.skipped.slice(0, SKIPPED_SHOWN),
      skippedTotal: parsed.skipped.length,
      duplicates: parsed.duplicates,
    };
  }
}
