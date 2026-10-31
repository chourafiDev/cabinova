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

const SUB = 'langue-atlas';
const EMAIL = 'langue@e2e.test';

/** Each person's interface language, French until they choose. */
describe('clinic: language', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const localeOf = async (agent: Agent) =>
    (await cab(agent).get('/auth/me').expect(200)).body.user.locale as string;

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@langue.test',
      role: 'secretary',
    });
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('follows the cabinet until someone chooses', async () => {
    expect(await localeOf(owner)).toBe('fr');
  });

  it('keeps the choice per person', async () => {
    await cab(secretary)
      .put('/settings/language')
      .send({ locale: 'ar' })
      .expect(200);
    expect(await localeOf(secretary)).toBe('ar');
    expect(await localeOf(owner)).toBe('fr');
  });

  it('keeps a language picked before sign-in, unless one is already chosen', async () => {
    await cab(owner)
      .put('/settings/language')
      .send({ locale: 'ar', onlyIfUnset: true })
      .expect(200);
    expect(await localeOf(owner)).toBe('ar');

    await cab(owner)
      .put('/settings/language')
      .send({ locale: 'fr', onlyIfUnset: true })
      .expect(200);
    expect(await localeOf(owner)).toBe('ar');

    await cab(owner)
      .put('/settings/language')
      .send({ locale: 'fr' })
      .expect(200);
    expect(await localeOf(owner)).toBe('fr');
  });

  it('refuses a language the app does not have', async () => {
    await cab(owner)
      .put('/settings/language')
      .send({ locale: 'en' })
      .expect(400);
    expect(await localeOf(owner)).toBe('fr');
  });
});
