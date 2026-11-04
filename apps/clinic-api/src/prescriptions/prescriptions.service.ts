import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service.js';
import type { PrescriptionDto } from './dto.js';

const PRESCRIPTION = `pr.id, pr.appointment_id as "appointmentId", pr.items,
  pr.notes, pr.updated_at as "updatedAt"`;

/** Ordonnances, one per visit. Callers check the user is a doctor. */
@Injectable()
export class PrescriptionsService {
  constructor(private readonly appointments: AppointmentsService) {}

  /** A visit's ordonnance, null until the doctor writes one (wrapped: a bare null is an empty body). */
  async visit(db: Pool, spaceId: string, appointmentId: string) {
    await this.appointments.get(db, spaceId, appointmentId);
    const { rows } = await db.query(
      `select ${PRESCRIPTION} from prescriptions pr where pr.appointment_id = $1`,
      [appointmentId],
    );
    return { prescription: rows[0] ?? null };
  }

  /** Saves the whole ordonnance (autosave): created on the first save. */
  async save(
    db: Pool,
    spaceId: string,
    appointmentId: string,
    dto: PrescriptionDto,
    userId: string,
  ) {
    const appointment = await this.appointments.get(db, spaceId, appointmentId);
    if (
      appointment.status === 'cancelled' ||
      appointment.status === 'no_show'
    ) {
      throw new BadRequestException({
        code: 'VISIT_CLOSED',
        message: 'Cette visite a été annulée : elle ne peut plus être remplie.',
      });
    }
    const items = dto.items.map((i) => ({
      medication: i.medication,
      posology: i.posology ?? null,
      duration: i.duration ?? null,
    }));
    const { rows } = await db.query(
      `insert into prescriptions as pr (appointment_id, patient_id, practitioner_id, items, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (appointment_id) do update set
         items = excluded.items, notes = excluded.notes,
         practitioner_id = excluded.practitioner_id, updated_at = now()
       returning ${PRESCRIPTION}`,
      [
        appointmentId,
        appointment.patient.id,
        userId,
        JSON.stringify(items),
        dto.notes ?? null,
      ],
    );
    return rows[0];
  }

  /** The patient's ordonnances in this space, newest first (for renewing one). */
  async history(db: Pool, spaceId: string, patientId: string) {
    const { rows } = await db.query(
      `select ${PRESCRIPTION}, a.starts_at as date, u.name as practitioner
         from prescriptions pr
         join appointments a on a.id = pr.appointment_id
         left join users u on u.id = pr.practitioner_id
        where pr.patient_id = $1 and a.space_id = $2
          and jsonb_array_length(pr.items) > 0
        order by a.starts_at desc
        limit 100`,
      [patientId, spaceId],
    );
    return rows;
  }

  /**
   * What this doctor has prescribed before, each medication once with its
   * latest posology and duration: suggested as they type.
   */
  async medications(db: Pool, userId: string) {
    const { rows } = await db.query(
      `select medication, posology, duration from (
         select distinct on (lower(i->>'medication'))
                i->>'medication' as medication, i->>'posology' as posology,
                i->>'duration' as duration, pr.updated_at
           from prescriptions pr, jsonb_array_elements(pr.items) i
          where pr.practitioner_id = $1
          order by lower(i->>'medication'), pr.updated_at desc
       ) m
       order by updated_at desc
       limit 500`,
      [userId],
    );
    return rows;
  }

  /** Everything the printed ordonnance shows. */
  async print(db: Pool, spaceId: string, appointmentId: string) {
    const { rows } = await db.query(
      `select pr.items, pr.notes, a.starts_at as date,
              json_build_object('firstName', p.first_name, 'lastName', p.last_name,
                'sex', p.sex, 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'),
                'fileNumber', p.file_number) as patient,
              coalesce(u.name, du.name) as practitioner,
              (select c.weight_kg::float8 from consultations c
                where c.appointment_id = a.id) as "weightKg",
              json_build_object('name', s.name, 'city', s.city, 'address', s.address,
                'phone', s.phone) as space
         from prescriptions pr
         join appointments a on a.id = pr.appointment_id
         join patients p on p.id = pr.patient_id
         join spaces s on s.id = a.space_id
         join users du on du.id = a.practitioner_id
         left join users u on u.id = pr.practitioner_id
        where pr.appointment_id = $1 and a.space_id = $2
          and jsonb_array_length(pr.items) > 0`,
      [appointmentId, spaceId],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PRESCRIPTION_NOT_FOUND',
        message: 'Ordonnance introuvable.',
      });
    }
    const cabinet = await db.query(
      `select name, legal_name as "legalName", specialty, address, city, phone, email
         from clinic_settings where id = 1`,
    );
    return { ...rows[0], cabinet: cabinet.rows[0] };
  }
}
