import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'journal-atlas';
const EMAIL = 'journal@e2e.test';
const SECRETARY = 'secretaire@journal.test';
const MONDAY = '2030-01-07';

type Entry = {
  actorName: string | null;
  action: string;
  target: string | null;
  detail: string | null;
};

/** The cabinet's journal: what goes in, who reads it, what never goes in. */
describe('clinic: activity log', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let patientId: string;
  let ownerId: string;
  let appointmentId: string;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const journal = async (query = '') =>
    (await cab(owner).get(`/activity${query}`).expect(200)).body as {
      data: Entry[];
      total: number;
      people: { id: string }[];
    };
  const has = (data: Entry[], action: string) =>
    data.filter((e) => e.action === action);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: SECRETARY,
      role: 'secretary',
    });
    ownerId = (await cab(owner).get('/auth/me').expect(200)).body.user.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('is for the responsible doctor alone, and cannot be edited', async () => {
    await cab(secretary).get('/activity').expect(403);
    await cab(owner).post('/activity').expect(404);
    await cab(owner).delete('/activity').expect(404);
  });

  it('records sign-ins, and failures with the address tried', async () => {
    const { data } = await journal();
    expect(has(data, 'auth.login').map((e) => e.actorName)).toContain(
      'Salma Secrétaire',
    );
    await cab(request.agent(clinic.getHttpServer()))
      .post('/auth/login')
      .send({ email: SECRETARY, password: 'ce-n-est-pas-le-bon' })
      .expect(401);
    const after = await journal('?category=security');
    expect(has(after.data, 'auth.login_failed')[0]).toMatchObject({
      actorName: null,
      target: SECRETARY,
    });
  });

  it('records changes with who did them and on which record', async () => {
    patientId = (
      await cab(secretary)
        .post('/patients')
        .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
        .expect(201)
    ).body.id;
    const { data } = await journal();
    expect(has(data, 'patient.create')[0]).toMatchObject({
      actorName: 'Salma Secrétaire',
      target: 'ALAOUI Omar',
    });

    appointmentId = (
      await cab(secretary)
        .post('/appointments')
        .send({
          patientId,
          practitionerId: ownerId,
          startsAt: `${MONDAY}T10:00:00+01:00`,
          endsAt: `${MONDAY}T10:30:00+01:00`,
        })
        .expect(201)
    ).body.id;
    await cab(secretary)
      .post(`/appointments/${appointmentId}/status`)
      .send({ status: 'arrived' })
      .expect(200);
    const after = await journal('?category=appointments');
    expect(has(after.data, 'appointment.status')[0].detail).toBe('arrived');
    expect(has(after.data, 'appointment.create')[0].target).toContain(
      'ALAOUI Omar',
    );
  });

  it('writes nothing when the action fails', async () => {
    const before = (await journal()).total;
    await cab(secretary)
      .post('/appointments')
      .send({
        patientId,
        practitionerId: ownerId,
        startsAt: `${MONDAY}T22:00:00+01:00`,
        endsAt: `${MONDAY}T22:30:00+01:00`,
      })
      .expect(400);
    expect((await journal()).total).toBe(before);
  });

  it('logs a doctor opening a file once an hour, not a secretary', async () => {
    await cab(secretary).get(`/patients/${patientId}`).expect(200);
    expect(has((await journal()).data, 'patient.view')).toHaveLength(0);

    await cab(owner).get(`/patients/${patientId}`).expect(200);
    await cab(owner).get(`/patients/${patientId}`).expect(200);
    expect(has((await journal()).data, 'patient.view')).toHaveLength(1);
  });

  it('notes a medical change, never its content', async () => {
    await cab(owner)
      .put(`/patients/${patientId}/medical-profile`)
      .send({ allergies: 'Pénicilline-secrète' })
      .expect(200);
    const { data } = await journal();
    expect(has(data, 'patient.medical_update')[0].target).toBe('ALAOUI Omar');
    expect(JSON.stringify(data)).not.toContain('Pénicilline');
  });

  it('keeps the name of what was deleted', async () => {
    const { body: spaces } = await cab(owner).get('/spaces').expect(200);
    const { body } = await cab(owner)
      .post('/team')
      .send({
        name: 'Karim Idrissi',
        email: 'karim@journal.test',
        role: 'secretary',
        spaceIds: [spaces.current.id],
      })
      .expect(201);
    await cab(owner).delete(`/team/${body.member.id}`).expect(204);
    const { data } = await journal('?category=team');
    expect(has(data, 'team.invite')[0].target).toBe('Karim Idrissi');
    expect(has(data, 'team.delete')[0].target).toBe('Karim Idrissi');
  });

  it('filters by person and searches names', async () => {
    const mine = await journal(`?userId=${ownerId}`);
    expect(mine.data.every((e) => e.actorName === 'Dr journal-atlas')).toBe(
      true,
    );
    const found = await journal('?search=alaoui');
    expect(found.total).toBeGreaterThan(0);
    expect(found.data.every((e) => (e.target ?? '').includes('ALAOUI'))).toBe(
      true,
    );
  });
});
