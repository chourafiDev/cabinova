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

const SUB = 'cloche-atlas';
const EMAIL = 'cloche@e2e.test';
const MONDAY = '2030-01-07';

type Inbox = {
  unread: number;
  data: {
    id: string;
    kind: string;
    title: string;
    href: string | null;
    readAt: string | null;
  }[];
};

/** The bell: who hears about what, once, and that nobody reads another's. */
describe('clinic: notifications', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let owner: Agent;
  let doctor: Agent;
  let secretary: Agent;
  let tenantId: string;
  let doctorId: string;
  let patientId: string;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const inbox = async (agent: Agent) =>
    (await cab(agent).get('/notifications').expect(200)).body as Inbox;
  const book = async (time: string) =>
    (
      await cab(secretary)
        .post('/appointments')
        .send({
          patientId,
          practitionerId: doctorId,
          startsAt: `${MONDAY}T${time}:00+01:00`,
          endsAt: `${MONDAY}T${time.slice(0, 3)}30:00+01:00`,
        })
        .expect(201)
    ).body.id as string;
  const setStatus = (agent: Agent, id: string, status: string) =>
    cab(agent).post(`/appointments/${id}/status`).send({ status }).expect(200);

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    await adminAgent
      .patch(`/tenants/${tenantId}`)
      .send({ maxDoctors: 3 })
      .expect(200);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    doctor = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Dr Yassine Amrani',
      email: 'amrani@cloche.test',
      role: 'doctor',
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@cloche.test',
      role: 'secretary',
    });
    doctorId = (await cab(doctor).get('/auth/me').expect(200)).body.user.id;
    patientId = (
      await cab(owner)
        .post('/patients')
        .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('tells the owner when an invited member joins', async () => {
    const { body: spaces } = await cab(owner).get('/spaces').expect(200);
    const { body } = await cab(owner)
      .post('/team')
      .send({
        name: 'Karim Idrissi',
        email: 'karim@cloche.test',
        role: 'secretary',
        spaceIds: [spaces.current.id],
      })
      .expect(201);
    const token = new URL(body.link.url as string).pathname.split('/').pop()!;
    expect((await inbox(owner)).unread).toBe(0);
    await cab(request.agent(clinic.getHttpServer()))
      .post(`/auth/invitations/${token}/accept`)
      .send({ password: 'mot-de-passe-equipe' })
      .expect(200);

    expect((await inbox(owner)).data[0]).toMatchObject({
      kind: 'team',
      title: 'Karim Idrissi a rejoint votre équipe',
      href: '/staff',
    });
    expect((await inbox(secretary)).data).toHaveLength(0);
    await cab(owner).post('/notifications/read').expect(204);
  });

  it('tells the doctor when the patient arrives, once, and not the one who clicked', async () => {
    const id = await book('10:00');
    await setStatus(secretary, id, 'arrived');
    await setStatus(secretary, id, 'scheduled');
    await setStatus(secretary, id, 'arrived');

    const { data, unread } = await inbox(doctor);
    expect(data.filter((n) => n.kind === 'arrived')).toHaveLength(1);
    expect(data[0]).toMatchObject({
      title: 'ALAOUI Omar est en salle d’attente',
      href: `/appointments?view=day&date=${MONDAY}`,
    });
    expect(unread).toBe(1);
    expect((await inbox(secretary)).data).toHaveLength(0);

    const self = await book('11:00');
    await setStatus(doctor, self, 'arrived');
    expect((await inbox(doctor)).unread).toBe(1);
  });

  it('tells the doctor and the owner about an absence', async () => {
    const id = await book('14:00');
    await setStatus(secretary, id, 'no_show');
    for (const agent of [doctor, owner]) {
      const { data } = await inbox(agent);
      expect(data.some((n) => n.kind === 'no_show')).toBe(true);
    }
  });

  it('lets each person read only their own', async () => {
    const before = await inbox(doctor);
    const first = before.data[0];
    await cab(secretary).post(`/notifications/${first.id}/read`).expect(204);
    expect((await inbox(doctor)).unread).toBe(before.unread);

    await cab(doctor).post(`/notifications/${first.id}/read`).expect(204);
    expect((await inbox(doctor)).unread).toBe(before.unread - 1);

    await cab(doctor).post('/notifications/read').expect(204);
    expect((await inbox(doctor)).unread).toBe(0);
  });

  it('brings the devis and the facture to the owner, not the team', async () => {
    const { body: quote } = await cab(owner)
      .post('/billing/quote')
      .send({ planKey: 'pro', billingPeriod: 'monthly' })
      .expect(200);
    expect((await inbox(owner)).data[0]).toMatchObject({
      kind: 'billing',
      title: `Devis ${quote.number} à régler`,
      href: `/devis/${quote.id}`,
    });
    expect((await inbox(doctor)).data.some((n) => n.kind === 'billing')).toBe(
      false,
    );

    const { body: paid } = await adminAgent
      .post(`/billing/quotes/${quote.id}/confirm`)
      .send({ amount: 59_900, receivedAt: new Date().toISOString() })
      .expect(200);
    const { data } = await inbox(owner);
    expect(data.map((n) => n.href)).toContain(`/factures/${paid.invoiceId}`);
    // Paid: the devis no longer asks for anything.
    expect(data.map((n) => n.href)).not.toContain(`/devis/${quote.id}`);
    expect(
      data.filter((n) => n.href === `/factures/${paid.invoiceId}`),
    ).toHaveLength(1);
  });
});
