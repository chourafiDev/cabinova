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
import { base32Decode, hotp, timeStep } from '../src/auth/totp.js';

const SUB = 'totp-atlas';
const EMAIL = 'totp@e2e.test';
const PASSWORD = 'mot-de-passe-docteur';
const STAFF_PASSWORD = 'mot-de-passe-equipe';
const SECRETARY = 'secretaire@totp.test';

/** The code an authenticator app shows, `offset` steps from now. */
const codeOf = (secret: string, offset = 0) =>
  hotp(base32Decode(secret), timeStep() + offset);

/** Two-factor sign-in of the cabinet's staff, from enrolment to a lost phone. */
describe('clinic: two-factor sign-in', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let owner: Agent;
  let secretary: Agent;
  let tenantId: string;
  let secret: string;
  let backup: string[];

  const cab = (agent?: Agent) => onCabinet(clinic, SUB, agent);
  const fresh = () => request.agent(clinic.getHttpServer());
  // Each sign-in from its own address: this suite signs in more often than
  // the login limit allows one person (5 a minute).
  let address = 0;
  const login = (agent: Agent, email = EMAIL, password = PASSWORD) =>
    cab(agent)
      .post('/auth/login')
      .set('X-Forwarded-For', `10.0.0.${++address}`)
      .send({ email, password })
      .expect(200);

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
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('enrols with a first valid code and gives ten backup codes', async () => {
    const { body } = await cab(owner).post('/auth/2fa/setup').expect(200);
    secret = body.secret;
    expect(body.otpauthUrl).toContain('otpauth://totp/');
    await cab(owner)
      .post('/auth/2fa/enable')
      .send({ code: '000000' })
      .expect(400);
    const enabled = await cab(owner)
      .post('/auth/2fa/enable')
      .send({ code: codeOf(secret) })
      .expect(200);
    backup = enabled.body.recoveryCodes;
    expect(backup).toHaveLength(10);
    const status = await cab(owner).get('/auth/2fa').expect(200);
    expect(status.body).toMatchObject({
      enabled: true,
      recoveryCodesLeft: 10,
      required: false,
    });
  });

  it('gives no session on the password alone, and counts wrong codes', async () => {
    const agent = fresh();
    const { body } = await login(agent);
    expect(body).toEqual({
      twoFactorRequired: true,
      challenge: expect.any(String),
    });
    await cab(agent).get('/auth/me').expect(401);

    for (let i = 0; i < 4; i++) {
      await cab(agent)
        .post('/auth/2fa/verify')
        .send({ challenge: body.challenge, code: '000000' })
        .expect(401);
    }
    const last = await cab(agent)
      .post('/auth/2fa/verify')
      .send({ challenge: body.challenge, code: '000000' })
      .expect(401);
    expect(last.body.code).toBe('CHALLENGE_EXPIRED');
    // Even the right code is refused now: the password comes first again.
    await cab(agent)
      .post('/auth/2fa/verify')
      .send({ challenge: body.challenge, code: codeOf(secret, 1) })
      .expect(401);
  });

  it('signs in with a code once, and a backup code only once', async () => {
    const agent = fresh();
    const { body } = await login(agent);
    await cab(agent)
      .post('/auth/2fa/verify')
      .send({ challenge: body.challenge, code: codeOf(secret, 1) })
      .expect(200);
    await cab(agent).get('/auth/me').expect(200);

    const replay = fresh();
    const second = await login(replay);
    await cab(replay)
      .post('/auth/2fa/verify')
      .send({ challenge: second.body.challenge, code: codeOf(secret, 1) })
      .expect(401);

    await cab(replay)
      .post('/auth/2fa/verify')
      .send({ challenge: second.body.challenge, code: backup[0] })
      .expect(200);
    const third = fresh();
    const again = await login(third);
    await cab(third)
      .post('/auth/2fa/verify')
      .send({ challenge: again.body.challenge, code: backup[0] })
      .expect(401);
  });

  it('forces the team to set it up once the owner requires it', async () => {
    await cab(secretary)
      .put('/team/two-factor')
      .send({ required: true })
      .expect(403);
    await cab(owner)
      .put('/team/two-factor')
      .send({ required: true })
      .expect(200);

    const blocked = await cab(secretary).get('/patients').expect(403);
    expect(blocked.body.code).toBe('TWO_FACTOR_SETUP_REQUIRED');
    const { body: me } = await cab(secretary).get('/auth/me').expect(200);
    expect(me.user.twoFactorSetupRequired).toBe(true);

    const { body } = await cab(secretary).post('/auth/2fa/setup').expect(200);
    await cab(secretary)
      .post('/auth/2fa/enable')
      .send({ code: codeOf(body.secret) })
      .expect(200);
    await cab(secretary).get('/patients').expect(200);

    // Required: nobody turns it off.
    const refused = await cab(secretary)
      .post('/auth/2fa/disable')
      .send({ code: codeOf(body.secret, 1) })
      .expect(409);
    expect(refused.body.code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('lets the owner reset a member, who is signed out and warned', async () => {
    const { body: team } = await cab(owner).get('/team').expect(200);
    const member = team.members.find(
      (m: { email: string }) => m.email === SECRETARY,
    );
    expect(member.twoFactor).toBe(true);
    const self = team.members.find((m: { role: string }) => m.role === 'owner');
    await cab(owner).post(`/team/${self.id}/two-factor/reset`).expect(403);

    await cab(owner).post(`/team/${member.id}/two-factor/reset`).expect(200);
    await cab(secretary).get('/auth/me').expect(401);

    await cab(owner)
      .put('/team/two-factor')
      .send({ required: false })
      .expect(200);
    const agent = fresh();
    const { body } = await login(agent, SECRETARY, STAFF_PASSWORD);
    expect(body).toEqual({ ok: true });
  });

  it('does not let a password link skip the code', async () => {
    const { body: team } = await cab(owner).get('/team').expect(200);
    const member = team.members.find(
      (m: { email: string }) => m.email === SECRETARY,
    );
    const agent = fresh();
    await login(agent, SECRETARY, STAFF_PASSWORD);
    const { body: setup } = await cab(agent)
      .post('/auth/2fa/setup')
      .expect(200);
    await cab(agent)
      .post('/auth/2fa/enable')
      .send({ code: codeOf(setup.secret) })
      .expect(200);

    const { body: link } = await cab(owner)
      .post(`/team/${member.id}/link`)
      .expect(200);
    const token = new URL(link.link.url as string).pathname.split('/').pop()!;
    const visitor = fresh();
    const { body } = await cab(visitor)
      .post(`/auth/invitations/${token}/accept`)
      .send({ password: STAFF_PASSWORD })
      .expect(200);
    expect(body).toEqual({ ok: true, loginRequired: true });
    await cab(visitor).get('/auth/me').expect(401);
  });

  it('lets the Super Admin reset the responsible doctor', async () => {
    await adminAgent
      .post(`/tenants/${tenantId}/owner-two-factor/reset`)
      .expect(200);
    await cab(owner).get('/auth/me').expect(401);
    const { body } = await login(fresh());
    expect(body).toEqual({ ok: true });
  });
});
