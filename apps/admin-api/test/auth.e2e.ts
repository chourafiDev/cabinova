import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { base32Decode, hotp, timeStep } from '../src/auth/totp.js';
import { type Agent, createApp, inviteUser, signInAdmin } from './app.js';

/** Authenticator code for the current step, or `ahead` steps later. */
const totp = (secret: string, ahead = 0) =>
  hotp(base32Decode(secret), timeStep() + ahead);

describe('auth and permissions', () => {
  let app: INestApplication;
  let admin: Agent;

  beforeAll(async () => {
    app = await createApp();
    admin = await signInAdmin(app);
  });
  afterAll(() => app.close());

  it('refuses anonymous requests and wrong passwords', async () => {
    const http = request(app.getHttpServer());
    await http.get('/auth/me').expect(401);
    await http.get('/tenants').expect(401);
    await http
      .post('/auth/login')
      .send({ email: 'admin@e2e.test', password: 'not-the-password' })
      .expect(401);
  });

  it('signs the seeded Super Admin in with every permission', async () => {
    const { body } = await admin.get('/auth/me').expect(200);
    expect(body.user.email).toBe('admin@e2e.test');
    expect(body.user.roles).toEqual([
      expect.objectContaining({ key: 'super_admin' }),
    ]);
    expect(body.user.permissions).toEqual(
      expect.arrayContaining(['tenants:write', 'billing:write', 'support:all']),
    );
  });

  it('limits a support agent to their permissions', async () => {
    const { agent } = await inviteUser(app, admin, {
      name: 'Agent Support',
      email: 'support@e2e.test',
      roleKeys: ['support_agent'],
    });
    await agent.get('/tenants').expect(200);
    await agent.get('/support/tickets').expect(200);
    await agent.post('/tenants').send({ name: 'Refusé' }).expect(403);
    await agent.get('/billing/invoices').expect(403);
    await agent.get('/platform-users').expect(403);
  });

  it('ends the session on sign-out', async () => {
    const { agent } = await inviteUser(app, admin, {
      name: 'Agent Sortie',
      email: 'logout@e2e.test',
      roleKeys: ['support_agent'],
    });
    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
  });

  it('requires the second factor once two-factor sign-in is on', async () => {
    const password = 'e2e-tech-password';
    const { agent } = await inviteUser(
      app,
      admin,
      {
        name: 'Agent Tech',
        email: 'tech@e2e.test',
        roleKeys: ['technical_agent'],
      },
      password,
    );

    const { body: setup } = await agent.post('/auth/2fa/setup').expect(200);
    await agent.post('/auth/2fa/enable').send({ code: '000000' }).expect(400);
    const { body: enabled } = await agent
      .post('/auth/2fa/enable')
      .send({ code: totp(setup.secret) })
      .expect(200);
    expect(enabled.recoveryCodes).toHaveLength(10);

    // Password alone: a challenge, no session.
    const http = request.agent(app.getHttpServer());
    const { body: login } = await http
      .post('/auth/login')
      .send({ email: 'tech@e2e.test', password })
      .expect(200);
    expect(login).toEqual({
      twoFactorRequired: true,
      challenge: expect.any(String),
    });
    await http.get('/auth/me').expect(401);

    await http
      .post('/auth/2fa/verify')
      .send({ challenge: login.challenge, code: '123456' })
      .expect(401);
    // The code used to enable is spent (no replay): the next step's is accepted.
    await http
      .post('/auth/2fa/verify')
      .send({ challenge: login.challenge, code: totp(setup.secret, 1) })
      .expect(200);
    const { body: me } = await http.get('/auth/me').expect(200);
    expect(me.twoFactor.enabled).toBe(true);

    // A recovery code works once.
    const [recovery] = enabled.recoveryCodes as string[];
    for (const expected of [200, 401]) {
      const { body: again } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'tech@e2e.test', password })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/2fa/verify')
        .send({ challenge: again.challenge, code: recovery })
        .expect(expected);
    }
  });
});
