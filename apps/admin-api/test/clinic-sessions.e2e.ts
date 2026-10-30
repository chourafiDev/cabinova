import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInAgain,
  signInDoctor,
} from './clinic.js';

const SUB = 'sessions-atlas';
const EMAIL = 'sessions@e2e.test';
const SECRETARY = 'secretaire@sessions.test';

type Session = {
  id: string;
  current: boolean;
  lastSeenAt: string;
  member: { id: string; name: string };
};

/** Sessions actives: the owner sees the team's devices and can sign them out. */
describe('clinic: active sessions', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let secondDevice: Agent;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const list = async () =>
    (await cab(owner).get('/team/sessions').expect(200)).body as Session[];

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
    secondDevice = await signInAgain(
      clinic,
      SUB,
      SECRETARY,
      'mot-de-passe-equipe',
    );
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('is for the responsible doctor alone', async () => {
    await cab(secretary).get('/team/sessions').expect(403);
    const sessions = await list();
    await cab(secretary).delete(`/team/sessions/${sessions[0].id}`).expect(403);
  });

  it('lists every device, with who and when', async () => {
    const sessions = await list();
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(sessions[0].lastSeenAt).toEqual(expect.any(String));
    expect(
      sessions.filter((s) => s.member.name === 'Salma Secrétaire'),
    ).toHaveLength(2);
  });

  it('signs out one device and leaves the others', async () => {
    const before = await list();
    const current = before.find((s) => s.current)!;
    await cab(owner).delete(`/team/sessions/${current.id}`).expect(404);

    const target = before.find((s) => s.member.name === 'Salma Secrétaire')!;
    await cab(owner).delete(`/team/sessions/${target.id}`).expect(204);
    const after = await list();
    expect(after).toHaveLength(2);
    expect(after.map((s) => s.id)).not.toContain(target.id);
  });

  it('signs a member out everywhere, never oneself this way', async () => {
    const sessions = await list();
    const own = sessions.find((s) => s.current)!;
    await cab(owner).post(`/team/${own.member.id}/sessions/revoke`).expect(409);

    const member = sessions.find((s) => !s.current)!.member;
    const { body } = await cab(owner)
      .post(`/team/${member.id}/sessions/revoke`)
      .expect(200);
    expect(body.revoked).toBe(1);
    await cab(secretary).get('/auth/me').expect(401);
    await cab(secondDevice).get('/auth/me').expect(401);
    await cab(owner).get('/auth/me').expect(200);
  });

  it('writes it in the journal', async () => {
    const { body } = await cab(owner)
      .get('/activity?category=team')
      .expect(200);
    const actions = (body.data as { action: string; target: string }[]).filter(
      (e) => e.action.includes('session'),
    );
    expect(actions.map((e) => e.action).sort()).toEqual([
      'team.session_revoke',
      'team.sessions_revoke',
    ]);
    expect(actions.every((e) => e.target === 'Salma Secrétaire')).toBe(true);
  });
});
