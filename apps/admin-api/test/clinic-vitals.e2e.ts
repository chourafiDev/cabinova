import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'constantes-atlas';

/**
 * Constantes: the front desk records dated measurements, the doctor reads
 * them; checked values, and only the author or the owner removes one.
 */
describe('clinic: constantes', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let neighbour: Agent;
  let patientId: string;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const vitals = (agent: Agent) =>
    cab(agent).get(`/patients/${patientId}/vitals`);
  const record = (agent: Agent, body: object) =>
    cab(agent).post(`/patients/${patientId}/vitals`).send(body);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(
      adminAgent,
      SUB,
      'constantes@e2e.test',
    );
    await provisionCabinet(
      adminAgent,
      'constantes-voisin',
      'voisin@constantes.test',
    );
    clinic = await createClinicApp();
    owner = await signInDoctor(
      clinic,
      SUB,
      invitations.get('constantes@e2e.test')!,
    );
    neighbour = await signInDoctor(
      clinic,
      'constantes-voisin',
      invitations.get('voisin@constantes.test')!,
    );
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Accueil',
      email: 'accueil@constantes.test',
      role: 'secretary',
    });
    patientId = (
      await cab(owner)
        .post('/patients')
        .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('lets the front desk record dated measurements, newest first', async () => {
    const { body: first } = await record(secretary, {
      measuredAt: new Date(Date.now() - 86_400_000).toISOString(),
      weightKg: 82.5,
      heightCm: 178,
      bloodGroup: 'A+',
    }).expect(201);
    expect(first).toMatchObject({
      weightKg: 82.5,
      heightCm: 178,
      bloodGroup: 'A+',
      recordedBy: 'Salma Accueil',
    });

    await record(secretary, {
      weightKg: 81,
      glycemia: 1.05,
      hba1c: 6.1,
      bpRightSystolic: 132,
      bpRightDiastolic: 84,
      bpLeftSystolic: 128,
      bpLeftDiastolic: 82,
      heartRate: 72,
      spo2: 98,
      temperatureC: 37.2,
      waistCm: 96,
      abdominalCircumferenceCm: 101,
      note: 'À jeun',
    }).expect(201);

    // The doctor reads the same history.
    const { body } = await vitals(owner).expect(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      weightKg: 81,
      heightCm: null,
      glycemia: 1.05,
      bpRightSystolic: 132,
      bpLeftDiastolic: 82,
      note: 'À jeun',
    });
    expect(body[1].weightKg).toBe(82.5);
  });

  it('refuses what cannot be right', async () => {
    const code = async (body: object) =>
      (await record(secretary, body).expect(400)).body.code;
    expect(await code({})).toBe('VITALS_EMPTY');
    expect(await code({ bpRightSystolic: 130 })).toBe('BP_INCOMPLETE');
    expect(await code({ bpLeftSystolic: 80, bpLeftDiastolic: 90 })).toBe(
      'BP_ORDER',
    );
    expect(
      await code({
        weightKg: 80,
        measuredAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ).toBe('MEASURED_IN_FUTURE');
    await record(secretary, { spo2: 120 }).expect(400);
    await record(secretary, { heartRate: 72.5 }).expect(400);
    await record(secretary, { bloodGroup: 'C+' }).expect(400);
  });

  it('lets only the author or the owner remove a measurement', async () => {
    const { body: mine } = await record(owner, { temperatureC: 38.4 }).expect(
      201,
    );
    const {
      body: [newest],
    } = await vitals(owner).expect(200);
    expect(newest.id).toBe(mine.id);
    const { body: list } = await vitals(secretary).expect(200);
    const taken = list.find(
      (v: { recordedBy: string }) => v.recordedBy === 'Salma Accueil',
    );

    const refused = await cab(secretary)
      .delete(`/patients/${patientId}/vitals/${mine.id}`)
      .expect(403);
    expect(refused.body).toMatchObject({
      code: 'NOT_YOURS',
      key: 'VITALS_NOT_YOURS',
    });
    await cab(secretary)
      .delete(`/patients/${patientId}/vitals/${taken.id}`)
      .expect(200);
    await cab(owner)
      .delete(`/patients/${patientId}/vitals/${mine.id}`)
      .expect(200);
    expect((await vitals(owner).expect(200)).body).toHaveLength(1);
  });

  it('keeps an archived file read-only, and other cabinets out', async () => {
    await cab(owner).post(`/patients/${patientId}/archive`).expect(200);
    expect(
      (await record(secretary, { weightKg: 80 }).expect(409)).body.code,
    ).toBe('PATIENT_ARCHIVED');
    await vitals(secretary).expect(200);
    await cab(owner).post(`/patients/${patientId}/restore`).expect(200);

    await onCabinet(clinic, 'constantes-voisin', neighbour)
      .get(`/patients/${patientId}/vitals`)
      .expect(404);
  });

  it('writes each record and removal in the journal', async () => {
    const { body } = await cab(owner).get('/activity').expect(200);
    const actions = body.data.map((e: { action: string }) => e.action);
    expect(actions).toContain('patient.vitals');
    expect(actions).toContain('patient.vitals_delete');
  });
});
