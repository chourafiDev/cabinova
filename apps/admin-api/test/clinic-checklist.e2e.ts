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

const SUB = 'demarrage-atlas';
const EMAIL = 'demarrage@e2e.test';
const MONDAY = '2030-01-07';

/** The getting-started checklist follows what the cabinet really does. */
describe('clinic: getting-started checklist', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let tenantId: string;
  let adminAgent: Agent;

  const cab = (agent: Agent = owner) => onCabinet(clinic, SUB, agent);
  const steps = async () =>
    (await cab().get('/onboarding/checklist').expect(200)).body.steps;

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('starts empty, for the responsible doctor only', async () => {
    expect(await steps()).toEqual({
      hours: false,
      acts: false,
      team: false,
      patient: false,
      appointment: false,
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@demarrage.test',
      role: 'secretary',
    });
    await cab(secretary).get('/onboarding/checklist').expect(403);
    await cab(secretary).post('/onboarding/checklist/dismiss').expect(403);
  });

  it('ticks each step when the cabinet does it', async () => {
    const { body: spaces } = await cab().get('/spaces').expect(200);
    await cab()
      .put(`/spaces/${spaces.current.id}/hours`)
      .send({ openingHours: spaces.current.openingHours })
      .expect(200);
    expect((await steps()).hours).toBe(true);
    await cab()
      .post('/acts')
      .send({ name: 'Consultation', price: 25000 })
      .expect(201);
    const { body: patient } = await cab()
      .post('/patients')
      .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
      .expect(201);
    const { body: me } = await cab().get('/auth/me').expect(200);
    await cab()
      .post('/appointments')
      .send({
        patientId: patient.id,
        practitionerId: me.user.id,
        startsAt: `${MONDAY}T10:00:00+01:00`,
        endsAt: `${MONDAY}T10:30:00+01:00`,
      })
      .expect(201);
    expect(await steps()).toEqual({
      hours: true,
      acts: true,
      team: true,
      patient: true,
      appointment: true,
    });
  });

  it('accepts the hours as they are, and stays hidden once dismissed', async () => {
    await cab().post('/onboarding/checklist/hours').expect(204);
    await cab().post('/onboarding/checklist/dismiss').expect(204);
    expect(await steps()).toBeNull();
  });
});
