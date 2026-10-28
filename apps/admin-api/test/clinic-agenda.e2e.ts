import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

/** 2026-11-02 (a Monday) at hh:mm, Moroccan time (UTC+1). */
const at = (hhmm: string) => `2026-11-02T${hhmm}:00+01:00`;

/**
 * The agenda of a space: booking, no double booking (across spaces too)
 * unless accepted, the status flow, and isolation between spaces.
 */
describe('clinic: agenda', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let doctor: Agent;
  let doctorId: string;
  let patientId: string;
  let firstId: string;
  let principalId: string;

  const cab = () => onCabinet(clinic, 'agenda-atlas', doctor);
  const book = (body: Record<string, unknown>) =>
    cab()
      .post('/appointments')
      .send({ patientId, practitionerId: doctorId, ...body });
  const day = async (includeCancelled = false) =>
    (
      await cab()
        .get('/appointments')
        .query({
          from: at('00:00'),
          to: '2026-11-03T00:00:00+01:00',
          includeCancelled,
        })
        .expect(200)
    ).body as { id: string; status: string }[];

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    await provisionCabinet(adminAgent, 'agenda-atlas', 'agenda@e2e.test');
    clinic = await createClinicApp();
    doctor = await signInDoctor(
      clinic,
      'agenda-atlas',
      invitations.get('agenda@e2e.test')!,
    );
    const { body: me } = await cab().get('/auth/me').expect(200);
    doctorId = me.user.id;
    principalId = me.spaces.current.id;
    const { body: patient } = await cab()
      .post('/patients')
      .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
      .expect(201);
    patientId = patient.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('lists the practitioners of the space', async () => {
    const { body } = await cab().get('/appointments/practitioners').expect(200);
    expect(body).toEqual([{ id: doctorId, name: 'Dr agenda-atlas' }]);
  });

  it('books an appointment with its patient and practitioner', async () => {
    const { body } = await book({
      startsAt: at('10:00'),
      endsAt: at('10:30'),
      reason: 'Fièvre',
    }).expect(201);
    firstId = body.id;
    expect(body).toMatchObject({
      status: 'scheduled',
      reason: 'Fièvre',
      arrivedAt: null,
      patient: { id: patientId, lastName: 'Alaoui', fileNumber: 1 },
      practitioner: { id: doctorId },
    });
    expect(new Date(body.startsAt).toISOString()).toBe(
      '2026-11-02T09:00:00.000Z',
    );
  });

  it('refuses a double booking unless the user accepts it', async () => {
    const { body } = await book({
      startsAt: at('10:15'),
      endsAt: at('10:45'),
    }).expect(409);
    expect(body).toMatchObject({
      code: 'SLOT_TAKEN',
      message:
        'Le praticien a déjà un rendez-vous de 10:00 à 10:30 (Espace principal).',
    });
    const { body: forced } = await book({
      startsAt: at('10:15'),
      endsAt: at('10:45'),
      allowOverlap: true,
    }).expect(201);
    // Back-to-back is fine.
    await book({ startsAt: at('10:45'), endsAt: at('11:00') }).expect(201);
    expect((await day()).map((a) => a.id)).toContain(forced.id);
    await book({ startsAt: at('11:00'), endsAt: at('10:00') }).expect(400);
  });

  it('frees the slot when cancelled, and checks it again when reopened', async () => {
    const { body: cancelled } = await book({
      startsAt: at('14:00'),
      endsAt: at('14:30'),
    }).expect(201);
    await cab()
      .post(`/appointments/${cancelled.id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect((await day()).map((a) => a.id)).not.toContain(cancelled.id);
    expect((await day(true)).map((a) => a.id)).toContain(cancelled.id);

    await book({ startsAt: at('14:00'), endsAt: at('14:30') }).expect(201);
    const { body } = await cab()
      .post(`/appointments/${cancelled.id}/status`)
      .send({ status: 'scheduled' })
      .expect(409);
    expect(body.code).toBe('SLOT_TAKEN');
  });

  it('follows the visit: arrived, in consultation, completed — then locked', async () => {
    const status = async (s: string) =>
      (
        await cab()
          .post(`/appointments/${firstId}/status`)
          .send({ status: s })
          .expect(200)
      ).body;
    const arrived = await status('arrived');
    expect(arrived.arrivedAt).toEqual(expect.any(String));
    expect((await status('in_consultation')).arrivedAt).toBe(arrived.arrivedAt);
    await status('completed');
    const { body } = await cab()
      .put(`/appointments/${firstId}`)
      .send({
        patientId,
        practitionerId: doctorId,
        startsAt: at('16:00'),
        endsAt: at('16:30'),
      })
      .expect(400);
    expect(body.code).toBe('COMPLETED');
  });

  it('keeps each space’s agenda apart, but one doctor in one place at a time', async () => {
    await cab().post('/spaces').send({ name: 'Marrakech' }).expect(201);
    // Marrakech: an empty agenda, nothing from the first space reachable.
    expect(await day(true)).toEqual([]);
    await cab()
      .post(`/appointments/${firstId}/status`)
      .send({ status: 'cancelled' })
      .expect(404);
    const { body: wrongPatient } = await book({
      startsAt: at('09:00'),
      endsAt: at('09:30'),
    }).expect(400);
    expect(wrongPatient.code).toBe('PATIENT_UNAVAILABLE');

    // A Marrakech patient can't be seen by the same doctor while they're in Fès.
    const { body: local } = await cab()
      .post('/patients')
      .send({ firstName: 'Salma', lastName: 'Bennani', sex: 'female' })
      .expect(201);
    const { body: clash } = await cab()
      .post('/appointments')
      .send({
        patientId: local.id,
        practitionerId: doctorId,
        startsAt: at('14:15'),
        endsAt: at('14:45'),
      })
      .expect(409);
    expect(clash.message).toContain('(Espace principal)');

    await cab()
      .put('/spaces/current')
      .send({ spaceId: principalId })
      .expect(200);
    expect((await day()).length).toBeGreaterThan(0);
  });

  it('feeds the dashboard from the agenda, per space and for all spaces', async () => {
    const { body: before } = await cab().get('/dashboard').expect(200);
    expect(before.scope).toBe('space');
    expect(before.week).toHaveLength(6);
    // Today's date comes from the API (Moroccan time); noon is safely inside it.
    const { body: today } = await book({
      startsAt: `${before.date}T12:00:00+01:00`,
      endsAt: `${before.date}T12:20:00+01:00`,
      allowOverlap: true,
    }).expect(201);

    const { body: after } = await cab().get('/dashboard').expect(200);
    expect(after.kpis.appointmentsToday).toBe(
      before.kpis.appointmentsToday + 1,
    );
    expect(after.kpis.upcomingToday).toBe(before.kpis.upcomingToday + 1);
    const listed = after.appointments.find(
      (a: { id: string }) => a.id === today.id,
    );
    // "Nouveau" on the dashboard: no completed visit before this one
    // (depends on today's date versus this suite's fixed November dates).
    expect(listed).toMatchObject({
      status: 'scheduled',
      firstVisit: expect.any(Boolean),
    });

    await cab()
      .post(`/appointments/${today.id}/status`)
      .send({ status: 'completed' })
      .expect(200);
    const { body: seen } = await cab().get('/dashboard').expect(200);
    expect(seen.kpis.seenToday).toBe(before.kpis.seenToday + 1);
    expect(seen.kpis.upcomingToday).toBe(before.kpis.upcomingToday);

    const { body: all } = await cab().get('/dashboard?scope=all').expect(200);
    expect(all.scope).toBe('all');
    expect(all.appointments).toBeNull();
    expect(all.bySpace.map((s: { name: string }) => s.name)).toEqual([
      'Espace principal',
      'Marrakech',
    ]);
    expect(all.kpis.appointmentsToday).toBeGreaterThanOrEqual(
      seen.kpis.appointmentsToday,
    );
  });
});
