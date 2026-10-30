import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  openEveryDay,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'stats-atlas';
const EMAIL = 'stats@e2e.test';
const SEPTEMBER = { from: '2026-09-01', to: '2026-09-30' };

/**
 * Statistiques: a known agenda (one visit in August, five appointments in
 * September) read back as totals, rates, series and breakdowns.
 */
describe('clinic: reports', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let doctor: Agent;
  let secretary: Agent;
  let ownerId: string;
  let doctorId: string;

  const cab = (agent: Agent = owner) => onCabinet(clinic, SUB, agent);
  const report = (query: Record<string, string>, agent: Agent = owner) =>
    cab(agent).get('/reports').query(query);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    await adminAgent
      .patch(`/tenants/${tenantId}`)
      .send({ maxDoctors: 3 })
      .expect(200);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    await openEveryDay(clinic, SUB, owner);
    doctor = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Dr Yassine Amrani',
      email: 'amrani@stats.test',
      role: 'doctor',
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@stats.test',
      role: 'secretary',
    });
    ownerId = (await cab().get('/auth/me').expect(200)).body.user.id;
    doctorId = (await cab(doctor).get('/auth/me').expect(200)).body.user.id;

    const patient = async (body: Record<string, string>) =>
      (await cab().post('/patients').send(body).expect(201)).body.id as string;
    const amina = await patient({
      firstName: 'Amina',
      lastName: 'Fassi',
      sex: 'female',
      birthDate: '1990-05-12',
      coverage: 'cnss',
    });
    const omar = await patient({
      firstName: 'Omar',
      lastName: 'Alaoui',
      sex: 'male',
      birthDate: '2015-02-01',
    });
    const leila = await patient({
      firstName: 'Leila',
      lastName: 'Bennani',
      sex: 'female',
      coverage: 'cnops',
    });
    const visit = async (
      patientId: string,
      practitionerId: string,
      start: string,
      status: string,
    ) => {
      const { body } = await cab()
        .post('/appointments')
        .send({
          patientId,
          practitionerId,
          startsAt: `${start}:00+01:00`,
          endsAt: `${start.slice(0, 13)}:30:00+01:00`,
        })
        .expect(201);
      await cab()
        .post(`/appointments/${body.id}/status`)
        .send({ status })
        .expect(200);
    };
    // August: Amina's first visit (so she is "returning" in September).
    await visit(amina, ownerId, '2026-08-20T09:00', 'completed');
    // September.
    await visit(amina, ownerId, '2026-09-07T09:00', 'completed');
    await visit(omar, doctorId, '2026-09-08T10:00', 'completed');
    await visit(leila, ownerId, '2026-09-08T11:00', 'no_show');
    await visit(leila, ownerId, '2026-09-09T09:00', 'cancelled');
    await visit(omar, doctorId, '2026-09-15T09:00', 'completed');
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('adds up the period and compares it with the one before', async () => {
    const { body } = await report(SEPTEMBER).expect(200);
    expect(body.period).toMatchObject({
      days: 30,
      bucket: 'day',
      previous: { from: '2026-08-02', to: '2026-08-31' },
    });
    expect(body.activity.totals).toEqual({
      appointments: 4,
      completed: 3,
      pending: 0,
      noShow: 1,
      cancelled: 1,
      patients: 2,
      newPatients: 1,
      noShowRate: 25,
      cancellationRate: 20,
    });
    expect(body.activity.previous).toMatchObject({
      completed: 1,
      newPatients: 1,
    });
    expect(body.activity.change.completed).toBe(200);
    expect(body.activity.series).toHaveLength(30);
    expect(
      body.activity.series.find(
        (d: { date: string }) => d.date === '2026-09-08',
      ),
    ).toEqual({
      date: '2026-09-08',
      completed: 1,
      pending: 0,
      noShow: 1,
      cancelled: 0,
      newPatients: 1,
      returningPatients: 0,
    });
  });

  it('describes the patients seen, by sex, age and coverage', async () => {
    const { body } = await report(SEPTEMBER).expect(200);
    expect(body.patients.sex).toEqual({ male: 1, female: 1 });
    const age = Object.fromEntries(
      body.patients.age.map((g: { key: string; count: number }) => [
        g.key,
        g.count,
      ]),
    );
    expect(age).toMatchObject({ '0-14': 1, '25-44': 1, unknown: 0 });
    expect(body.patients.coverage).toEqual(
      expect.arrayContaining([
        { key: 'cnss', count: 1 },
        { key: 'none', count: 1 },
      ]),
    );
  });

  it('splits by doctor, and shows when appointments happen', async () => {
    const { body } = await report(SEPTEMBER).expect(200);
    expect(body.byPractitioner).toEqual([
      expect.objectContaining({ id: doctorId, completed: 2, patients: 1 }),
      expect.objectContaining({ id: ownerId, completed: 1, noShowRate: 50 }),
    ]);
    expect(body.bySpace).toBeNull();
    expect(body.affluence.heatmap).toEqual(
      expect.arrayContaining([
        { weekday: 1, hour: 9, count: 1 },
        { weekday: 2, hour: 10, count: 1 },
      ]),
    );
    expect(
      body.affluence.heatmap.reduce(
        (s: number, c: { count: number }) => s + c.count,
        0,
      ),
    ).toBe(4);
    expect(body.filters.practitioners.map((p: { id: string }) => p.id)).toEqual(
      [ownerId, doctorId],
    );
  });

  it('weekly buckets for a longer period', async () => {
    const { body } = await report({
      from: '2026-08-01',
      to: '2026-10-31',
    }).expect(200);
    expect(body.period.bucket).toBe('week');
    expect(body.activity.totals.completed).toBe(4);
    await report({ from: '2026-01-01', to: '2027-06-30' }).expect(400);
    await report({ from: '2026-09-30', to: '2026-09-01' }).expect(400);
  });

  it('doctors: the cabinet or their own figures; secretaries: nothing', async () => {
    const { body: all } = await report(SEPTEMBER, doctor).expect(200);
    expect(all.activity.totals.completed).toBe(3);
    expect(all.byPractitioner).toBeNull();
    const { body: mine } = await report(
      { ...SEPTEMBER, practitioner: doctorId },
      doctor,
    ).expect(200);
    expect(mine.activity.totals).toMatchObject({ completed: 2, patients: 1 });
    await report({ ...SEPTEMBER, practitioner: ownerId }, doctor).expect(403);
    await report(SEPTEMBER, secretary).expect(403);
  });
});
