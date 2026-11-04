import type { Pool } from '@neondatabase/serverless';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { CONSULTATION_FIELDS, type ConsultationDto } from './dto.js';

/** A consultation as the API returns it (numbers as numbers). */
const CONSULTATION = `
  c.id, c.appointment_id as "appointmentId", c.complaint, c.history,
  c.examination, c.diagnosis, c.plan, c.systolic, c.diastolic,
  c.heart_rate as "heartRate", c.spo2, c.height_cm as "heightCm",
  c.temperature::float8 as temperature, c.weight_kg::float8 as "weightKg",
  c.glycemia::float8 as glycemia, c.updated_at as "updatedAt"`;

/** The doctor's notes of each visit. Callers check the user is a doctor. */
@Injectable()
export class ConsultationsService {
  constructor(private readonly appointments: AppointmentsService) {}

  /** A visit and its notes (null until the doctor writes something). */
  async visit(db: Pool, spaceId: string, appointmentId: string) {
    const appointment = await this.appointments.get(db, spaceId, appointmentId);
    const { rows } = await db.query(
      `select ${CONSULTATION} from consultations c where c.appointment_id = $1`,
      [appointmentId],
    );
    return { appointment, consultation: rows[0] ?? null };
  }

  /** Saves the whole form (autosave): created on the first save. */
  async save(
    db: Pool,
    spaceId: string,
    appointmentId: string,
    dto: ConsultationDto,
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
    const columns = CONSULTATION_FIELDS.map(([c]) => c);
    const params = [
      appointmentId,
      appointment.patient.id,
      userId,
      ...CONSULTATION_FIELDS.map(([, k]) => dto[k] ?? null),
    ];
    await db.query(
      `insert into consultations (appointment_id, patient_id, practitioner_id, ${columns.join(', ')})
       values ($1, $2, $3, ${columns.map((_, i) => `$${i + 4}`).join(', ')})
       on conflict (appointment_id) do update set
         ${columns.map((c) => `${c} = excluded.${c}`).join(', ')},
         practitioner_id = excluded.practitioner_id, updated_at = now()`,
      params,
    );
    const { rows } = await db.query(
      `select ${CONSULTATION} from consultations c where c.appointment_id = $1`,
      [appointmentId],
    );
    return rows[0];
  }

  /** The patient's past notes, newest first, with the visit's date and doctor. */
  async history(db: Pool, spaceId: string, patientId: string) {
    const { rows } = await db.query(
      `select ${CONSULTATION}, a.starts_at as "date", a.reason as act,
              u.name as practitioner
         from consultations c
         join appointments a on a.id = c.appointment_id
         left join users u on u.id = c.practitioner_id
        where c.patient_id = $1 and a.space_id = $2
        order by a.starts_at desc
        limit 100`,
      [patientId, spaceId],
    );
    return rows;
  }
}
