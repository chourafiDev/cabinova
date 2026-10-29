import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

const SUB = 'equipe-atlas';
const EMAIL = 'equipe@e2e.test';
const tokenOf = (url: string) => new URL(url).pathname.split('/').pop()!;

type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  spaceIds: string[];
};

/**
 * Équipe: the owner invites doctors and secretaries into spaces, within the
 * offer's limits, changes their role, deactivates them or sends a new link.
 */
describe('clinic: team', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let owner: Agent;
  let secretary: Agent;
  let tenantId: string;
  let firstSpaceId: string;
  let doctorId: string;

  const cab = (agent: Agent = owner) => onCabinet(clinic, SUB, agent);
  const members = async () =>
    (await cab().get('/team').expect(200)).body.members as Member[];
  /** Accepts an invitation or password link: a signed-in agent. */
  const accept = async (url: string, password: string) => {
    const agent = request.agent(clinic.getHttpServer());
    await cab(agent)
      .post(`/auth/invitations/${tokenOf(url)}/accept`)
      .send({ password })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    // Room for a second doctor (the offer counts the owner).
    await adminAgent
      .patch(`/tenants/${tenantId}`)
      .send({ maxDoctors: 3 })
      .expect(200);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@equipe.test',
      role: 'secretary',
    });
    const { body } = await cab().get('/auth/me').expect(200);
    firstSpaceId = body.spaces.current.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('is the owner’s only', async () => {
    await cab(secretary).get('/team').expect(403);
    await cab(secretary)
      .post('/team')
      .send({
        name: 'Dr X',
        email: 'x@equipe.test',
        role: 'doctor',
        spaceIds: [firstSpaceId],
      })
      .expect(403);
    const { body } = await cab().get('/team').expect(200);
    expect(body.members[0]).toMatchObject({
      email: EMAIL,
      role: 'owner',
      status: 'active',
    });
    expect(body.limits.secretaries.used).toBe(1);
    expect(body.spaces).toEqual([
      expect.objectContaining({ id: firstSpaceId }),
    ]);
  });

  it('invites a doctor who joins with the link', async () => {
    const { body } = await cab()
      .post('/team')
      .send({
        name: '  Dr Karim Benali ',
        email: ' Karim@Equipe.test ',
        role: 'doctor',
        spaceIds: [firstSpaceId],
      })
      .expect(201);
    expect(body.member).toMatchObject({
      name: 'Dr Karim Benali',
      email: 'karim@equipe.test',
      role: 'doctor',
      roleLabel: 'Médecin',
      status: 'invited',
      spaceIds: [firstSpaceId],
    });
    expect(body.link).toMatchObject({ kind: 'invitation', delivery: 'logged' });
    expect(body.link.url).toMatch(
      /^http:\/\/equipe-atlas\.localhost:3002\/invite\//,
    );
    doctorId = body.member.id;

    const { body: who } = await cab(request.agent(clinic.getHttpServer()))
      .get(`/auth/invitations/${tokenOf(body.link.url)}`)
      .expect(200);
    expect(who.email).toBe('karim@equipe.test');
    const doctor = await accept(body.link.url, 'mot-de-passe-karim');
    const { body: me } = await cab(doctor).get('/auth/me').expect(200);
    expect(me.user.role).toBe('doctor');
    expect(me.spaces.spaces.map((s: { id: string }) => s.id)).toEqual([
      firstSpaceId,
    ]);
    expect((await members()).find((m) => m.id === doctorId)?.status).toBe(
      'active',
    );
  });

  it('refuses a taken e-mail, unknown spaces and no space', async () => {
    const invite = (body: Record<string, unknown>) =>
      cab()
        .post('/team')
        .send({
          name: 'Dr Autre',
          email: 'autre@equipe.test',
          role: 'doctor',
          spaceIds: [firstSpaceId],
          ...body,
        });
    const { body: taken } = await invite({
      email: 'KARIM@equipe.test',
    }).expect(409);
    expect(taken.code).toBe('EMAIL_TAKEN');
    const { body: unknown } = await invite({
      spaceIds: ['00000000-0000-4000-8000-000000000000'],
    }).expect(400);
    expect(unknown.code).toBe('INVALID_SPACES');
    await invite({ spaceIds: [] }).expect(400);
    await invite({ role: 'owner' }).expect(400);
  });

  it('keeps to the offer’s limits', async () => {
    await adminAgent
      .patch(`/tenants/${tenantId}`)
      .send({ maxSecretaries: 1 })
      .expect(200);
    const { body } = await cab()
      .post('/team')
      .send({
        name: 'Nadia',
        email: 'nadia@equipe.test',
        role: 'secretary',
        spaceIds: [firstSpaceId],
      })
      .expect(409);
    expect(body.code).toBe('LIMIT_REACHED');
    expect(body.message).toContain('1 secrétaire');
    // Nor by turning the doctor into a secretary.
    await cab()
      .put(`/team/${doctorId}`)
      .send({
        name: 'Dr Karim Benali',
        role: 'secretary',
        spaceIds: [firstSpaceId],
      })
      .expect(409);
    await adminAgent
      .patch(`/tenants/${tenantId}`)
      .send({ maxSecretaries: null })
      .expect(200);
  });

  it('changes spaces and role; not with appointments to come', async () => {
    const { body: created } = await cab()
      .post('/spaces')
      .send({ name: 'Marrakech' })
      .expect(201);
    const marrakechId = created.current.id;
    const { body: moved } = await cab()
      .put(`/team/${doctorId}`)
      .send({
        name: 'Dr Karim Benali',
        role: 'doctor',
        spaceIds: [marrakechId, firstSpaceId],
      })
      .expect(200);
    expect([...moved.spaceIds].sort()).toEqual(
      [firstSpaceId, marrakechId].sort(),
    );

    // Booked in Marrakech (the owner's current space now).
    const { body: patient } = await cab()
      .post('/patients')
      .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
      .expect(201);
    await cab()
      .post('/appointments')
      .send({
        patientId: patient.id,
        practitionerId: doctorId,
        startsAt: '2030-01-07T10:00:00+01:00',
        endsAt: '2030-01-07T10:30:00+01:00',
      })
      .expect(201);
    const { body: refused } = await cab()
      .put(`/team/${doctorId}`)
      .send({
        name: 'Dr Karim Benali',
        role: 'secretary',
        spaceIds: [firstSpaceId],
      })
      .expect(409);
    expect(refused.code).toBe('HAS_APPOINTMENTS');
    expect((await members()).find((m) => m.id === doctorId)).toMatchObject({
      role: 'doctor',
      upcomingAppointments: 1,
    });
  });

  // Sign-in is limited to 5 attempts a minute: these two tests share them.
  let doctor: Agent;

  it('sends a new password link; the old password works until it is used', async () => {
    const { body } = await cab().post(`/team/${doctorId}/link`).expect(200);
    expect(body.link.kind).toBe('password');
    await signInAgain(clinic, SUB, 'karim@equipe.test', 'mot-de-passe-karim');
    doctor = await accept(body.link.url, 'nouveau-karim-2030');
    await cab(request.agent(clinic.getHttpServer()))
      .post('/auth/login')
      .send({ email: 'karim@equipe.test', password: 'mot-de-passe-karim' })
      .expect(401);
  });

  it('deactivates (signed out, no sign-in) and reactivates', async () => {
    await cab(doctor).get('/auth/me').expect(200);
    const { body } = await cab()
      .post(`/team/${doctorId}/deactivate`)
      .expect(200);
    expect(body.status).toBe('disabled');
    await cab(doctor).get('/auth/me').expect(401);
    await cab(request.agent(clinic.getHttpServer()))
      .post('/auth/login')
      .send({ email: 'karim@equipe.test', password: 'nouveau-karim-2030' })
      .expect(401);
    await cab().post(`/team/${doctorId}/link`).expect(409);

    await cab().post(`/team/${doctorId}/reactivate`).expect(200);
    await signInAgain(clinic, SUB, 'karim@equipe.test', 'nouveau-karim-2030');
  });

  it('deletes a pending invitation only; never touches the owner', async () => {
    const { body } = await cab()
      .post('/team')
      .send({
        name: 'Nadia',
        email: 'nadia@equipe.test',
        role: 'secretary',
        spaceIds: [firstSpaceId],
      })
      .expect(201);
    await cab().delete(`/team/${body.member.id}`).expect(204);
    // Its link died with it.
    await cab(request.agent(clinic.getHttpServer()))
      .get(`/auth/invitations/${tokenOf(body.link.url)}`)
      .expect(404);

    const { body: joined } = await cab()
      .delete(`/team/${doctorId}`)
      .expect(409);
    expect(joined.code).toBe('ALREADY_JOINED');
    const ownerId = (await members())[0].id;
    await cab().post(`/team/${ownerId}/deactivate`).expect(403);
    await cab().delete(`/team/${ownerId}`).expect(403);
  });
});
