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

const SUB = 'messages-atlas';

/**
 * Messages between the staff: a direct conversation per pair, named
 * groups, and the cabinet's room. Only members read a conversation; each
 * person's unread count, pins, mutes and archives are their own.
 */
describe('clinic: staff chat', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let doctor: Agent;
  let secretary: Agent;
  const ids: Record<'owner' | 'doctor' | 'secretary', string> = {
    owner: '',
    doctor: '',
    secretary: '',
  };

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const me = async (agent: Agent) =>
    (await cab(agent).get('/auth/me').expect(200)).body.user.id as string;
  const unread = async (agent: Agent) =>
    (await cab(agent).get('/chat/unread').expect(200)).body.count as number;
  const find = async (agent: Agent, id: string) =>
    ((await cab(agent).get('/chat/conversations').expect(200)).body as {
      id: string;
      unread: number;
      pinned: boolean;
      muted: boolean;
      archived: boolean;
      kind: string;
      lastMessage: { body: string } | null;
    }[]).find((c) => c.id === id);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, 'messages@e2e.test');
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get('messages@e2e.test')!);
    doctor = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Dr Yassine Berrada',
      email: 'berrada@messages.test',
      role: 'doctor',
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Accueil',
      email: 'accueil@messages.test',
      role: 'secretary',
    });
    ids.owner = await me(owner);
    ids.doctor = await me(doctor);
    ids.secretary = await me(secretary);
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('lists the colleagues one may write to', async () => {
    const { body } = await cab(secretary).get('/chat/people').expect(200);
    expect(body.map((p: { id: string }) => p.id).sort()).toEqual(
      [ids.owner, ids.doctor].sort(),
    );
  });

  it('keeps one direct conversation per pair, read by its two members only', async () => {
    const { body: first } = await cab(secretary)
      .post('/chat/conversations')
      .send({ userIds: [ids.owner] })
      .expect(201);
    const { body: again } = await cab(owner)
      .post('/chat/conversations')
      .send({ userIds: [ids.secretary] })
      .expect(201);
    expect(again.id).toBe(first.id);

    const { body: sent } = await cab(secretary)
      .post(`/chat/conversations/${first.id}/messages`)
      .send({ body: '  Le patient de 10 h est arrivé.  ' })
      .expect(201);
    expect(sent).toMatchObject({
      body: 'Le patient de 10 h est arrivé.',
      senderId: ids.secretary,
      senderName: 'Salma Accueil',
    });
    await cab(owner)
      .post(`/chat/conversations/${first.id}/messages`)
      .send({ body: '   ' })
      .expect(400);

    // The other doctor isn't in it: to them it doesn't exist.
    const { body: hidden } = await cab(doctor)
      .get(`/chat/conversations/${first.id}/messages`)
      .expect(404);
    expect(hidden.code).toBe('CONVERSATION_NOT_FOUND');
    expect(await find(doctor, first.id)).toBeUndefined();

    expect(await find(owner, first.id)).toMatchObject({
      kind: 'direct',
      unread: 1,
      lastMessage: { body: 'Le patient de 10 h est arrivé.' },
    });
    // The sender has read their own message.
    expect((await find(secretary, first.id))?.unread).toBe(0);
    expect(await unread(owner)).toBe(1);

    const { body: page } = await cab(owner)
      .get(`/chat/conversations/${first.id}/messages`)
      .expect(200);
    expect(page).toMatchObject({ hasMore: false });
    expect(page.messages).toHaveLength(1);
    await cab(owner).post(`/chat/conversations/${first.id}/read`).expect(204);
    expect(await unread(owner)).toBe(0);
  });

  it('has the cabinet room, with everyone in it', async () => {
    const room = (
      (await cab(owner).get('/chat/conversations').expect(200)).body as {
        id: string;
        kind: string;
      }[]
    ).find((c) => c.kind === 'cabinet')!;
    await cab(owner)
      .post(`/chat/conversations/${room.id}/messages`)
      .send({ body: 'Réunion d’équipe à 13 h.' })
      .expect(201);
    expect((await find(doctor, room.id))?.unread).toBe(1);
    expect((await find(secretary, room.id))?.unread).toBe(1);
  });

  it('makes named groups only', async () => {
    const { body: unnamed } = await cab(owner)
      .post('/chat/conversations')
      .send({ userIds: [ids.doctor, ids.secretary] })
      .expect(400);
    expect(unnamed.code).toBe('GROUP_NAME_REQUIRED');
    const { body: stranger } = await cab(owner)
      .post('/chat/conversations')
      .send({ userIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);
    expect(stranger.code).toBe('CHAT_USER_NOT_FOUND');
    const { body: group } = await cab(owner)
      .post('/chat/conversations')
      .send({ userIds: [ids.doctor, ids.secretary], name: 'Garde du samedi' })
      .expect(201);
    expect(await find(doctor, group.id)).toMatchObject({ kind: 'group' });
  });

  it('pins, mutes and archives for one person only', async () => {
    const { body: direct } = await cab(doctor)
      .post('/chat/conversations')
      .send({ userIds: [ids.secretary] })
      .expect(201);
    await cab(doctor)
      .post(`/chat/conversations/${direct.id}/messages`)
      .send({ body: 'Pouvez-vous rappeler Mme Tazi ?' })
      .expect(201);
    const before = await unread(secretary);

    await cab(secretary)
      .put(`/chat/conversations/${direct.id}`)
      .send({ pinned: true, muted: true })
      .expect(204);
    expect(await find(secretary, direct.id)).toMatchObject({ pinned: true, muted: true });
    expect(await unread(secretary)).toBe(before - 1);
    // Pinned first in the list.
    const list = (await cab(secretary).get('/chat/conversations').expect(200)).body;
    expect(list[0].id).toBe(direct.id);
    // The other member's view is unchanged.
    expect(await find(doctor, direct.id)).toMatchObject({ pinned: false, muted: false });

    await cab(secretary)
      .put(`/chat/conversations/${direct.id}`)
      .send({ archived: true, muted: false })
      .expect(204);
    expect((await find(secretary, direct.id))?.archived).toBe(true);
    // A new message brings it back.
    await cab(doctor)
      .post(`/chat/conversations/${direct.id}/messages`)
      .send({ body: 'Merci !' })
      .expect(201);
    expect(await find(secretary, direct.id)).toMatchObject({ archived: false, unread: 2 });
  });
});
