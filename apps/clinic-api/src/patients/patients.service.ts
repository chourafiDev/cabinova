import type { Pool, PoolClient } from '@neondatabase/serverless';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ListPatientsQuery,
  MedicalProfileDto,
  PatientDto,
} from './dto.js';
import { patientSearch } from './search.js';

/** Column list of a patient as the API returns it (camelCase). */
const PATIENT = `
  p.id, p.file_number as "fileNumber", p.first_name as "firstName",
  p.last_name as "lastName", p.sex, to_char(p.birth_date, 'YYYY-MM-DD') as "birthDate",
  p.cin, p.phone, p.email, p.address, p.city, p.coverage,
  p.coverage_number as "coverageNumber", p.insurer,
  p.emergency_contact_name as "emergencyContactName",
  p.emergency_contact_phone as "emergencyContactPhone", p.notes,
  p.archived_at as "archivedAt", p.created_at as "createdAt",
  p.updated_at as "updatedAt"`;

const SORT_COLUMNS = {
  lastName: 'p.last_name',
  fileNumber: 'p.file_number',
  birthDate: 'p.birth_date',
  createdAt: 'p.created_at',
} as const;

/** Writable columns, in the DTO's order. */
const FIELDS = [
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['sex', 'sex'],
  ['birth_date', 'birthDate'],
  ['cin', 'cin'],
  ['phone', 'phone'],
  ['email', 'email'],
  ['address', 'address'],
  ['city', 'city'],
  ['coverage', 'coverage'],
  ['coverage_number', 'coverageNumber'],
  ['insurer', 'insurer'],
  ['emergency_contact_name', 'emergencyContactName'],
  ['emergency_contact_phone', 'emergencyContactPhone'],
  ['notes', 'notes'],
] as const;

const PROFILE_FIELDS = [
  ['blood_group', 'bloodGroup'],
  ['allergies', 'allergies'],
  ['chronic_conditions', 'chronicConditions'],
  ['medical_history', 'medicalHistory'],
  ['surgical_history', 'surgicalHistory'],
  ['family_history', 'familyHistory'],
  ['current_treatments', 'currentTreatments'],
] as const;

/** Postgres unique_violation on the CIN index. */
const isCinTaken = (err: unknown) =>
  (err as { code?: string; constraint?: string } | null)?.code === '23505' &&
  (err as { constraint?: string }).constraint === 'patients_space_cin_idx';

const values = (dto: PatientDto) =>
  FIELDS.map(([, key]) =>
    key === 'coverage' ? (dto.coverage ?? 'none') : (dto[key] ?? null),
  );

/**
 * Patients of the request's space, in the cabinet's own database. Every
 * query is filtered by the space: a file from another space answers 404.
 * Records are archived, never deleted. The medical profile is a separate
 * table, read and written by doctors only (checked by the controller).
 */
@Injectable()
export class PatientsService {
  async list(db: Pool, spaceId: string, query: ListPatientsQuery) {
    const where = [
      'p.space_id = $1',
      query.status === 'archived'
        ? 'p.archived_at is not null'
        : 'p.archived_at is null',
    ];
    const params: unknown[] = [spaceId];
    const search = query.search && patientSearch(query.search, 2, 'p.');
    if (search) {
      where.push(search.sql);
      params.push(...search.values);
    }
    const [field, dir] = query.sort.split('.') as [
      keyof typeof SORT_COLUMNS,
      'asc' | 'desc',
    ];
    const order = `${SORT_COLUMNS[field]} ${dir} nulls last, p.last_name, p.first_name, p.file_number`;
    const filter = where.join(' and ');
    const offset = (query.page - 1) * query.perPage;

    const [rows, total] = await Promise.all([
      db.query(
        `select ${PATIENT} from patients p where ${filter}
          order by ${order} limit ${query.perPage} offset ${offset}`,
        params,
      ),
      db.query<{ count: string }>(
        `select count(*) from patients p where ${filter}`,
        params,
      ),
    ]);
    const count = Number(total.rows[0].count);
    return {
      data: rows.rows,
      total: count,
      pageCount: Math.max(1, Math.ceil(count / query.perPage)),
    };
  }

  async get(db: Pool, spaceId: string, id: string, withMedical: boolean) {
    const patient = await this.find(db, spaceId, id);
    if (!withMedical) return patient;
    const { rows } = await db.query(
      `select blood_group as "bloodGroup", allergies,
              chronic_conditions as "chronicConditions",
              medical_history as "medicalHistory",
              surgical_history as "surgicalHistory",
              family_history as "familyHistory",
              current_treatments as "currentTreatments",
              updated_at as "updatedAt"
         from medical_profiles where patient_id = $1`,
      [id],
    );
    return { ...patient, medicalProfile: rows[0] ?? null };
  }

  async create(db: Pool, spaceId: string, dto: PatientDto, userId: string) {
    const columns = [...FIELDS.map(([c]) => c), 'created_by', 'space_id'];
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    try {
      const { rows } = await db.query<{ id: string }>(
        `insert into patients (${columns.join(', ')})
         values (${placeholders.join(', ')}) returning id`,
        [...values(dto), userId, spaceId],
      );
      return this.find(db, spaceId, rows[0].id);
    } catch (err) {
      throw await this.cinConflict(db, spaceId, err, dto.cin);
    }
  }

  async update(db: Pool, spaceId: string, id: string, dto: PatientDto) {
    await this.find(db, spaceId, id);
    const set = FIELDS.map(([c], i) => `${c} = $${i + 2}`).join(', ');
    try {
      await db.query(
        `update patients set ${set}, updated_at = now() where id = $1`,
        [id, ...values(dto)],
      );
    } catch (err) {
      throw await this.cinConflict(db, spaceId, err, dto.cin, id);
    }
    return this.find(db, spaceId, id);
  }

  async setArchived(db: Pool, spaceId: string, id: string, archived: boolean) {
    const { rowCount } = await db.query(
      `update patients set archived_at = ${archived ? 'coalesce(archived_at, now())' : 'null'},
              updated_at = now() where id = $1 and space_id = $2`,
      [id, spaceId],
    );
    if (!rowCount) throw this.notFound();
    return this.find(db, spaceId, id);
  }

  async saveMedicalProfile(
    db: Pool,
    spaceId: string,
    id: string,
    dto: MedicalProfileDto,
    userId: string,
  ) {
    await this.find(db, spaceId, id);
    const columns = PROFILE_FIELDS.map(([c]) => c);
    const params = [
      id,
      ...PROFILE_FIELDS.map(([, k]) => dto[k] ?? null),
      userId,
    ];
    await db.query(
      `insert into medical_profiles (patient_id, ${columns.join(', ')}, updated_by)
       values ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')}, $${columns.length + 2})
       on conflict (patient_id) do update set
         ${columns.map((c) => `${c} = excluded.${c}`).join(', ')},
         updated_by = excluded.updated_by, updated_at = now()`,
      params,
    );
    return this.get(db, spaceId, id, true);
  }

  private async find(db: Pool | PoolClient, spaceId: string, id: string) {
    const { rows } = await db.query(
      `select ${PATIENT} from patients p where p.id = $1 and p.space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) throw this.notFound();
    return rows[0] as Record<string, unknown>;
  }

  /** The CIN belongs to another file: say which one. */
  private async cinConflict(
    db: Pool,
    spaceId: string,
    err: unknown,
    cin: string | null | undefined,
    exceptId?: string,
  ) {
    if (!isCinTaken(err) || !cin) return err;
    const { rows } = await db.query<{ file_number: number }>(
      `select file_number from patients
        where space_id = $1 and cin = $2
          and id <> coalesce($3::uuid, '00000000-0000-0000-0000-000000000000')`,
      [spaceId, cin, exceptId ?? null],
    );
    return new ConflictException({
      code: 'CIN_TAKEN',
      message: `Ce CIN correspond déjà au dossier n° ${rows[0]?.file_number ?? '?'}.`,
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient introuvable.',
    });
  }
}
