import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EmailService } from '../src/email/email.service.js';
import { type Agent, createApp, signInAdmin, waitFor } from './app.js';

// clinic-api is another app (its own package and tsconfig): loaded at
// runtime only, against the same test catalog and master key.
const clinicSrc = (file: string) =>
  new URL(`../../clinic-api/src/${file}`, import.meta.url).href;

async function createClinicApp() {
  const { AppModule } = (await import(clinicSrc('app.module.ts'))) as {
    AppModule: Type;
  };
  const { configureApp } = (await import(clinicSrc('app.setup.ts'))) as {
    configureApp: (app: NestExpressApplication) => unknown;
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  await app.init();
  return app;
}

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
  const invitations = new Map<string, string>();
  const ids = new Map<string, string>();

  /** A request to the clinic API on a cabinet's subdomain, as the Next proxy sends it. */
  const on = (subdomain: string, agent = request(clinic.getHttpServer())) => ({
    get: (path: string) =>
      agent.get(path).set('Host', `${subdomain}.localhost:3002`),
    post: (path: string) =>
      agent.post(path).set('Host', `${subdomain}.localhost:3002`),
  });

  async function provisionCabinet(subdomain: string, email: string) {
    const { body } = await adminAgent
      .post('/tenants')
      .send({
        name: `Cabinet ${subdomain}`,
        responsibleName: `Dr ${subdomain}`,
        email,
        specialty: 'Médecine générale',
        subdomain,
        planKey: 'pro',
      })
      .expect(201);
    ids.set(subdomain, body.id);
    await adminAgent.post(`/tenants/${body.id}/provision`).expect(202);
    await waitFor(async () => {
      const { body: db } = await adminAgent.get(`/tenants/${body.id}/database`);
      if (db.runs[0]?.state === 'failed')
        throw new Error(JSON.stringify(db.runs[0]));
      return db.runs[0]?.state === 'succeeded';
    });
  }

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    // No e-mail provider in tests: keep the links the doctors would receive.
    vi.spyOn(admin.get(EmailService), 'sendInvitation').mockImplementation(
      async ({ email, url }) => {
        invitations.set(email, new URL(url).pathname.split('/').pop()!);
      },
    );
    await provisionCabinet('flow', 'flow@e2e.test');
    await provisionCabinet('voisin', 'voisin@e2e.test');
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
    expect(invitation).toEqual({ name: 'Dr flow', email: 'flow@e2e.test' });

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
