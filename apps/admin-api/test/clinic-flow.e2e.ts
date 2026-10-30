import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  captureInvitations,
  createClinicApp,
  provisionCabinet,
} from './clinic.js';

/**
 * The path from the Super Admin to a doctor working in their own space:
 * create and provision a cabinet, follow the invitation link on its
 * subdomain, choose a password, sign in — and nothing leaks to another
 * cabinet's address.
 */
describe('clinic sign-in: from provisioning to the dashboard', () => {
  let admin: INestApplication;
  let adminAgent: Agent;
  let clinic: INestApplication;
  let invitations: Map<string, string>;
  const ids = new Map<string, string>();

  /** A request to the clinic API on a cabinet's subdomain, as the Next proxy sends it. */
  const on = (subdomain: string, agent = request(clinic.getHttpServer())) => ({
    get: (path: string) =>
      agent.get(path).set('Host', `${subdomain}.localhost:3002`),
    post: (path: string) =>
      agent.post(path).set('Host', `${subdomain}.localhost:3002`),
  });

  const provision = async (subdomain: string, email: string) => {
    ids.set(subdomain, await provisionCabinet(adminAgent, subdomain, email));
  };

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    invitations = captureInvitations(admin);
    await provision('flow', 'flow@e2e.test');
    await provision('voisin', 'voisin@e2e.test');
    clinic = await createClinicApp();
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it("answers on the cabinet's subdomain only", async () => {
    const { body } = await on('flow').get('/clinic').expect(200);
    expect(body).toMatchObject({ name: 'Cabinet flow', subdomain: 'flow' });
    const unknown = await on('inconnu').get('/clinic').expect(404);
    expect(unknown.body.code).toBe('TENANT_NOT_FOUND');
    await request(clinic.getHttpServer())
      .get('/clinic')
      .set('Host', 'localhost:3002')
      .expect(404);
    await on('flow').get('/auth/me').expect(401);
  });

  it('turns the invitation into a password and a session', async () => {
    const token = invitations.get('flow@e2e.test')!;
    expect(token).toBeDefined();
    // The link belongs to its cabinet: useless on another subdomain.
    await on('voisin').get(`/auth/invitations/${token}`).expect(404);

    const { body: invitation } = await on('flow')
      .get(`/auth/invitations/${token}`)
      .expect(200);
    expect(invitation).toEqual({
      name: 'Dr flow',
      email: 'flow@e2e.test',
      reset: false,
    });

    const doctor = request.agent(clinic.getHttpServer());
    await on('flow', doctor)
      .post(`/auth/invitations/${token}/accept`)
      .send({ password: 'court' })
      .expect(400);
    await on('flow', doctor)
      .post(`/auth/invitations/${token}/accept`)
      .send({ password: 'mot-de-passe-flow' })
      .expect(200);

    const { body: me } = await on('flow', doctor).get('/auth/me').expect(200);
    expect(me.user).toMatchObject({
      name: 'Dr flow',
      email: 'flow@e2e.test',
      role: 'owner',
    });
    expect(me.cabinet).toMatchObject({
      name: 'Cabinet flow',
      subdomain: 'flow',
    });
    expect(me.subscription).toMatchObject({
      plan: 'Pro',
      status: 'trialing',
      doctors: { used: 1, max: 1 },
      secretaries: { used: 0, max: 3 },
    });
    expect(me.subscription.trialEndsAt).toEqual(expect.any(String));

    // First sign-in: the product tour starts once, then is remembered.
    expect(me.onboarding).toEqual({ tourCompleted: false });
    await on('flow', doctor).post('/onboarding/tour').expect(204);
    await on('flow', doctor).post('/onboarding/tour').expect(204);
    const { body: after } = await on('flow', doctor)
      .get('/auth/me')
      .expect(200);
    expect(after.onboarding).toEqual({ tourCompleted: true });
    await on('flow').post('/onboarding/tour').expect(401);

    // The responsible doctor's billing view: price after the trial, nothing due yet.
    const { body: billing } = await on('flow', doctor)
      .get('/billing/summary')
      .expect(200);
    expect(billing).toMatchObject({
      plan: 'Pro',
      billingPeriod: 'monthly',
      status: 'trialing',
      nextAmount: 59_900,
      openInvoice: null,
    });
    expect(billing.trialEndsAt).toEqual(expect.any(String));
    await on('flow').get('/billing/summary').expect(401);

    // Single use.
    await on('flow').get(`/auth/invitations/${token}`).expect(404);

    // The session opens this cabinet only, even if the cookie were sent elsewhere.
    await on('voisin', doctor).get('/auth/me').expect(401);
  });

  it('signs out and back in with the chosen password', async () => {
    const doctor = request.agent(clinic.getHttpServer());
    await on('flow', doctor)
      .post('/auth/login')
      .send({ email: 'flow@e2e.test', password: 'pas-le-bon' })
      .expect(401);
    // Right password, wrong cabinet: that account doesn't exist there.
    await on('voisin', doctor)
      .post('/auth/login')
      .send({ email: 'flow@e2e.test', password: 'mot-de-passe-flow' })
      .expect(401);
    await on('flow', doctor)
      .post('/auth/login')
      .send({ email: 'FLOW@e2e.test', password: 'mot-de-passe-flow' })
      .expect(200);
    await on('flow', doctor).get('/auth/me').expect(200);
    await on('flow', doctor).post('/auth/logout').expect(204);
    await on('flow', doctor).get('/auth/me').expect(401);
  });

  it('re-sends the invitation until the doctor has chosen a password', async () => {
    const before = invitations.get('voisin@e2e.test')!;
    const { body: resent } = await adminAgent
      .post(`/tenants/${ids.get('voisin')}/database/invitation`)
      .expect(200);
    // The link itself is shown to the admin in development only.
    expect(resent).toEqual({ email: 'voisin@e2e.test' });
    const after = invitations.get('voisin@e2e.test')!;
    expect(after).not.toBe(before);
    await on('voisin').get(`/auth/invitations/${before}`).expect(404);
    await on('voisin').get(`/auth/invitations/${after}`).expect(200);

    const { body } = await adminAgent
      .post(`/tenants/${ids.get('flow')}/database/invitation`)
      .expect(409);
    expect(body.code).toBe('ALREADY_ACCEPTED');
  });

  it('closes the door when the platform suspends the cabinet', async () => {
    await adminAgent
      .post(`/tenants/${ids.get('flow')}/status-changes`)
      .send({
        action: 'suspend',
        reason: 'unpaid',
        comment: 'Test de suspension',
        notifyResponsible: false,
      })
      .expect(201);
    // A fresh clinic API (the running one caches the status for 30 s).
    const fresh = await createClinicApp();
    try {
      const { body } = await request(fresh.getHttpServer())
        .post('/auth/login')
        .set('Host', 'flow.localhost:3002')
        .send({ email: 'flow@e2e.test', password: 'mot-de-passe-flow' })
        .expect(403);
      expect(body.code).toBe('TENANT_SUSPENDED');
    } finally {
      await fresh.close();
    }
  });
});
