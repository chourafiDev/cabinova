import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Agent, createApp, signInAdmin, waitFor } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'oubli-atlas';
const EMAIL = 'oubli@e2e.test';
const SECRETARY = 'secretaire@oubli.test';
const NEW_PASSWORD = 'un-tout-nouveau-mot-de-passe';

const clinicSrc = (file: string) =>
  new URL(`../../clinic-api/src/${file}`, import.meta.url).href;

/** "Mot de passe oublié": a link for real accounts, and nothing to learn from it. */
describe('clinic: forgot password', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let owner: Agent;
  let tenantId: string;
  let secretary: Agent;
  let sent: ReturnType<typeof vi.spyOn>;

  const cab = (agent?: Agent) => onCabinet(clinic, SUB, agent);
  const fresh = () => request.agent(clinic.getHttpServer());
  let address = 0;
  /** Each request from its own address: the limit is tested on its own. */
  const forgot = (email: string) =>
    cab(fresh())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', `10.1.0.${++address}`)
      .send({ email })
      .expect(200);
  const tokenOf = (call: number) =>
    new URL((sent.mock.calls[call][0] as { url: string }).url).pathname
      .split('/')
      .pop()!;

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: SECRETARY,
      role: 'secretary',
    });
    const { MailService } = (await import(
      clinicSrc('mail/mail.service.ts')
    )) as { MailService: new () => { sendPasswordReset: () => unknown } };
    sent = vi
      .spyOn(clinic.get(MailService), 'sendPasswordReset')
      .mockResolvedValue('logged' as never);
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('answers the same for an unknown address, and sends nothing', async () => {
    const { body } = await forgot('personne@oubli.test');
    expect(body).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sent).not.toHaveBeenCalled();
  });

  it('leaves an invitation that was never accepted alone', async () => {
    const { body: spaces } = await cab(owner).get('/spaces').expect(200);
    await cab(owner)
      .post('/team')
      .send({
        name: 'Karim Idrissi',
        email: 'karim@oubli.test',
        role: 'secretary',
        spaceIds: [spaces.current.id],
      })
      .expect(201);
    await forgot('karim@oubli.test');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sent).not.toHaveBeenCalled();
  });

  it('sends one link a minute, and it changes the password once', async () => {
    await forgot(` ${SECRETARY.toUpperCase()} `.trim());
    await waitFor(async () => sent.mock.calls.length === 1);
    expect(sent.mock.calls[0][0]).toMatchObject({ email: SECRETARY });
    await forgot(SECRETARY);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sent).toHaveBeenCalledOnce();

    const token = tokenOf(0);
    const { body: link } = await cab(fresh())
      .get(`/auth/invitations/${token}`)
      .expect(200);
    expect(link).toMatchObject({ email: SECRETARY, reset: true });

    await cab(fresh())
      .post(`/auth/invitations/${token}/accept`)
      .send({ password: NEW_PASSWORD })
      .expect(200);

    // Other devices are out, the old password too; the link is spent.
    await cab(secretary).get('/auth/me').expect(401);
    await cab(fresh())
      .post('/auth/login')
      .send({ email: SECRETARY, password: 'mot-de-passe-equipe' })
      .expect(401);
    await cab(fresh())
      .post('/auth/login')
      .send({ email: SECRETARY, password: NEW_PASSWORD })
      .expect(200);
    await cab(fresh()).get(`/auth/invitations/${token}`).expect(404);

    // Not a new arrival: nobody is told they joined.
    const { body: inbox } = await cab(owner).get('/notifications').expect(200);
    expect(
      inbox.data.some((n: { title: string }) => n.title.includes('Salma')),
    ).toBe(false);
  });

  it('limits requests from one address', async () => {
    const agent = fresh();
    const send = () =>
      cab(agent)
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', '10.2.0.1')
        .send({ email: 'x@oubli.test' });
    await send().expect(200);
    await send().expect(200);
    await send().expect(200);
    await send().expect(429);
  });
});
