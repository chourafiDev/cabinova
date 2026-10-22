import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { audit } from '../common/audit.js';
import { nextNumber } from '../common/counters.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  appointments,
  consultations,
  patients,
} from '../database/schema/index.js';
import { COVERAGES, type ListPatientsQuery, type PatientDto } from './dto.js';

const listColumns = {
  id: patients.id,
  fileNumber: patients.fileNumber,
  firstName: patients.firstName,
  lastName: patients.lastName,
  sex: patients.sex,
  birthDate: patients.birthDate,
  cin: patients.cin,
  phone: patients.phone,
  city: patients.city,
  coverage: patients.coverage,
  archivedAt: patients.archivedAt,
  createdAt: patients.createdAt,
};

const SORT_COLUMNS = {
  lastName: [patients.lastName, patients.firstName],
  fileNumber: [patients.fileNumber],
  birthDate: [patients.birthDate],
  createdAt: [patients.createdAt],
} as const;

/** Columns written from the form (absent optional fields are cleared). */
const toValues = (dto: PatientDto) => ({
  firstName: dto.firstName,
  lastName: dto.lastName,
  sex: dto.sex,
  birthDate: dto.birthDate ?? null,
  cin: dto.cin ?? null,
  phone: dto.phone ?? null,
  email: dto.email ?? null,
  address: dto.address ?? null,
  city: dto.city ?? null,
  coverage: dto.coverage ?? 'none',
  coverageNumber: dto.coverageNumber ?? null,
  insurer: dto.insurer ?? null,
  emergencyContactName: dto.emergencyContactName ?? null,
  emergencyContactPhone: dto.emergencyContactPhone ?? null,
  notes: dto.notes ?? null,
});

/** Escapes LIKE wildcards in user input. */
const like = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PatientsService {
  constructor(private readonly database: DatabaseService) {}

  list(query: ListPatientsQuery) {
    const where = and(
      query.status === 'archived'
        ? isNotNull(patients.archivedAt)
        : isNull(patients.archivedAt),
      query.sex
        ? inArray(patients.sex, query.sex.split(',') as ('male' | 'female')[])
        : undefined,
      query.coverage
        ? inArray(
            patients.coverage,
            query.coverage.split(',') as (typeof COVERAGES)[number][],
          )
        : undefined,
      query.search?.trim()
        ? this.searchCondition(query.search.trim())
        : undefined,
      query.createdFrom
        ? gte(patients.createdAt, new Date(query.createdFrom))
        : undefined,
      // `createdTo` is the picked day's start (local midnight): include the
      // whole day by moving to just before the next one.
      query.createdTo
        ? lte(
            patients.createdAt,
            new Date(new Date(query.createdTo).getTime() + DAY_MS - 1),
          )
        : undefined,
    );
    const [column, direction] = query.sort.split('.') as [
      keyof typeof SORT_COLUMNS,
      'asc' | 'desc',
    ];
    const order = SORT_COLUMNS[column].map((c) =>
      direction === 'desc' ? desc(c) : asc(c),
    );

    return this.database.tenant(async (tx) => {
      const [rows, [{ total }]] = await Promise.all([
        tx
          .select(listColumns)
          .from(patients)
          .where(where)
          .orderBy(...order, asc(patients.id))
          .limit(query.perPage)
          .offset((query.page - 1) * query.perPage),
        tx.select({ total: count() }).from(patients).where(where),
      ]);
      return {
        data: rows,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      };
    });
  }

  get(id: string) {
    return this.database.tenant((tx) => this.find(tx, id));
  }

  create(user: AuthUser, dto: PatientDto) {
    return this.database.tenant(async (tx) => {
      await this.assertCinFree(tx, dto.cin);
      const [patient] = await tx
        .insert(patients)
        .values({
          ...toValues(dto),
          tenantId: user.tenantId,
          fileNumber: await nextNumber(tx, 'patient'),
          createdById: user.id,
        })
        .returning();
      await audit(tx, user, {
        action: 'patient.create',
        entity: 'patient',
        entityId: patient.id,
      });
      return patient;
    });
  }

  update(user: AuthUser, id: string, dto: PatientDto) {
    return this.database.tenant(async (tx) => {
      const before = await this.find(tx, id);
      await this.assertCinFree(tx, dto.cin, id);
      const values = toValues(dto);
      const [patient] = await tx
        .update(patients)
        .set(values)
        .where(eq(patients.id, id))
        .returning();
      const changed = (Object.keys(values) as (keyof typeof values)[]).filter(
        (k) => before[k] !== values[k],
      );
      if (changed.length) {
        await audit(tx, user, {
          action: 'patient.update',
          entity: 'patient',
          entityId: id,
          metadata: { fields: changed },
        });
      }
      return patient;
    });
  }

  setArchived(user: AuthUser, id: string, archived: boolean) {
    return this.database.tenant(async (tx) => {
      await this.find(tx, id);
      const [patient] = await tx
        .update(patients)
        .set({ archivedAt: archived ? new Date() : null })
        .where(eq(patients.id, id))
        .returning();
      await audit(tx, user, {
        action: archived ? 'patient.archive' : 'patient.restore',
        entity: 'patient',
        entityId: id,
      });
      return patient;
    });
  }

  /** CSV of the selected files (every administrative field), for Excel. */
  export(user: AuthUser, ids: string[]) {
    return this.database.tenant(async (tx) => {
      const rows = await tx
        .select()
        .from(patients)
        .where(inArray(patients.id, ids))
        .orderBy(asc(patients.fileNumber));
      await audit(tx, user, {
        action: 'patient.export',
        entity: 'patient',
        metadata: { count: rows.length },
      });
      return toCsv(rows);
    });
  }

  /**
   * Deletes files created by mistake. A file with appointments or
   * consultations is kept (health records keep their history: archive it).
   */
  bulkDelete(user: AuthUser, ids: string[]) {
    return this.database.tenant(async (tx) => {
      const used = new Set(
        [
          ...(await tx
            .selectDistinct({ id: appointments.patientId })
            .from(appointments)
            .where(inArray(appointments.patientId, ids))),
          ...(await tx
            .selectDistinct({ id: consultations.patientId })
            .from(consultations)
            .where(inArray(consultations.patientId, ids))),
        ].map((r) => r.id),
      );
      const deletable = ids.filter((id) => !used.has(id));
      const deleted = deletable.length
        ? await tx
            .delete(patients)
            .where(inArray(patients.id, deletable))
            .returning({ id: patients.id, fileNumber: patients.fileNumber })
        : [];
      for (const p of deleted) {
        await audit(tx, user, {
          action: 'patient.delete',
          entity: 'patient',
          entityId: p.id,
          metadata: { fileNumber: p.fileNumber },
        });
      }
      return { deleted: deleted.length, kept: ids.length - deleted.length };
    });
  }

  private async find(tx: Transaction, id: string) {
    const [patient] = await tx
      .select()
      .from(patients)
      .where(eq(patients.id, id));
    if (!patient) throw new NotFoundException('Patient introuvable.');
    return patient;
  }

  /** One CIN = one patient file per clinic. */
  private async assertCinFree(
    tx: Transaction,
    cin: string | null | undefined,
    exceptId?: string,
  ) {
    if (!cin) return;
    const [other] = await tx
      .select({ id: patients.id, fileNumber: patients.fileNumber })
      .from(patients)
      .where(eq(patients.cin, cin));
    if (other && other.id !== exceptId) {
      throw new ConflictException({
        code: 'CIN_TAKEN',
        message: `Ce CIN correspond déjà au dossier n° ${other.fileNumber}.`,
        patientId: other.id,
      });
    }
  }

  /** Name (any order), phone, CIN or file number. */
  private searchCondition(term: string): SQL | undefined {
    const digits = term.replace(/\D/g, '');
    const conditions: (SQL | undefined)[] = [
      ilike(
        sql`${patients.firstName} || ' ' || ${patients.lastName}`,
        like(term),
      ),
      ilike(
        sql`${patients.lastName} || ' ' || ${patients.firstName}`,
        like(term),
      ),
      ilike(patients.cin, like(term)),
    ];
    if (digits.length >= 3) {
      conditions.push(ilike(patients.phone, like(digits)));
    }
    if (/^\d+$/.test(term)) {
      conditions.push(eq(patients.fileNumber, Number(term)));
    }
    return or(...conditions);
  }
}

const SEX_CSV = { male: 'Homme', female: 'Femme' } as const;
const COVERAGE_CSV = {
  none: 'Aucune',
  cnss: 'CNSS (AMO)',
  cnops: 'CNOPS',
  amo_tadamon: 'AMO Tadamon',
  far: 'FAR',
  private: 'Assurance privée',
} as const;

type PatientRecord = typeof patients.$inferSelect;

type CsvValue = string | number | null | undefined;

const CSV_COLUMNS: [string, (p: PatientRecord) => CsvValue][] = [
  ['N° dossier', (p) => p.fileNumber],
  ['Nom', (p) => p.lastName],
  ['Prénom', (p) => p.firstName],
  ['Sexe', (p) => SEX_CSV[p.sex]],
  ['Date de naissance', (p) => p.birthDate],
  ['CIN', (p) => p.cin],
  ['Téléphone', (p) => p.phone],
  ['E-mail', (p) => p.email],
  ['Adresse', (p) => p.address],
  ['Ville', (p) => p.city],
  ['Couverture', (p) => COVERAGE_CSV[p.coverage]],
  ["N° d'immatriculation", (p) => p.coverageNumber],
  ['Assureur', (p) => p.insurer],
  ["Contact d'urgence", (p) => p.emergencyContactName],
  ["Téléphone d'urgence", (p) => p.emergencyContactPhone],
  ['Note', (p) => p.notes],
  ['Créé le', (p) => p.createdAt.toISOString().slice(0, 10)],
  ['Archivé le', (p) => p.archivedAt?.toISOString().slice(0, 10)],
];

/**
 * Excel-friendly CSV: UTF-8 BOM, ";" separator (French locale), quoted
 * cells. Cells starting with = + - @ get a leading ' (formula injection).
 */
function toCsv(rows: PatientRecord[]) {
  const cell = (value: CsvValue) => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [
    CSV_COLUMNS.map(([header]) => cell(header)).join(';'),
    ...rows.map((row) =>
      CSV_COLUMNS.map(([, get]) => cell(get(row))).join(';'),
    ),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
