import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  openEveryDay,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'caisse-atlas';
const EMAIL = 'caisse@e2e.test';
/** Today in Morocco, at a given hour (UTC+1). */
const todayAt = (time: string) =>
  `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())}T${time}:00+01:00`;

/**
 * Encaissements: price list, a visit checked out in two payments, receipt,
 * a cancelled payment and a refund, then the blind cash close that locks
 * the day — and the owner's totals.
 */
describe('clinic: payments', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let appointmentId: string;
  let patientId: string;
  let consultation: { id: string; name: string; price: number };
  let ecg: { id: string; name: string; price: number };
  let cardPaymentId: string;
  let chargeId: string;

  const cab = (agent: Agent = secretary) => onCabinet(clinic, SUB, agent);
  const items = () => [
    {
      actId: consultation.id,
      label: consultation.name,
      unitPrice: consultation.price,
      quantity: 1,
    },
    { actId: ecg.id, label: ecg.name, unitPrice: ecg.price, quantity: 1 },
  ];

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    await openEveryDay(clinic, SUB, owner);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@caisse.test',
      role: 'secretary',
    });
    const { body: me } = await cab(owner).get('/auth/me').expect(200);
    const { body: patient } = await cab(owner)
      .post('/patients')
      .send({ firstName: 'Omar', lastName: 'Alaoui', sex: 'male' })
      .expect(201);
    patientId = patient.id;
    const { body: appointment } = await cab(owner)
      .post('/appointments')
      .send({
        patientId,
        practitionerId: me.user.id,
        startsAt: todayAt('10:00'),
        endsAt: todayAt('10:30'),
      })
      .expect(201);
    appointmentId = appointment.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('keeps a price list the owner edits', async () => {
    consultation = (
      await cab(owner)
        .post('/acts')
        .send({ name: ' Consultation ', price: 25000 })
        .expect(201)
    ).body;
    ecg = (
      await cab(owner)
        .post('/acts')
        .send({ name: 'ECG', price: 30000 })
        .expect(201)
    ).body;
    expect(consultation).toMatchObject({
      name: 'Consultation',
      price: 25000,
      active: true,
    });
    const { body: taken } = await cab(owner)
      .post('/acts')
      .send({ name: 'consultation', price: 1 })
      .expect(409);
    expect(taken.code).toBe('ACT_NAME_TAKEN');
    await cab().post('/acts').send({ name: 'Visite', price: 1 }).expect(403);
    const { body: archived } = await cab(owner)
      .post('/acts')
      .send({ name: 'Ancien tarif', price: 10000 })
      .expect(201);
    await cab(owner).post(`/acts/${archived.id}/archive`).expect(200);
    expect((await cab().get('/acts').expect(200)).body).toHaveLength(2);
    expect(
      (await cab(owner).get('/acts').query({ archived: 'true' }).expect(200))
        .body,
    ).toHaveLength(3);
  });

  it('checks a visit out in two payments, never more than the balance', async () => {
    const empty = (
      await cab().get(`/appointments/${appointmentId}/account`).expect(200)
    ).body;
    expect(empty).toMatchObject({ chargeId: null, total: 0, balance: 0 });

    const { body: first } = await cab()
      .post(`/appointments/${appointmentId}/checkout`)
      .send({ items: items(), payment: { amount: 30000, method: 'cash' } })
      .expect(200);
    expect(first).toMatchObject({ total: 55000, paid: 30000, balance: 25000 });
    expect(first.payments[0].receiptNumber).toMatch(/^R-\d{4}-\d{6}$/);
    chargeId = first.chargeId;

    const { body: over } = await cab()
      .post(`/appointments/${appointmentId}/checkout`)
      .send({ items: items(), payment: { amount: 30000, method: 'card' } })
      .expect(400);
    expect(over.code).toBe('OVERPAYMENT');

    const { body: second } = await cab()
      .post(`/appointments/${appointmentId}/checkout`)
      .send({
        items: items(),
        payment: { amount: 25000, method: 'card', reference: 'TPE 0042' },
      })
      .expect(200);
    expect(second).toMatchObject({ balance: 0, paid: 55000 });
    cardPaymentId = second.paymentId;

    const { body: receipt } = await cab()
      .get(`/payments/${second.paymentId}/receipt`)
      .expect(200);
    expect(receipt).toMatchObject({
      amount: 25000,
      method: 'card',
      reference: 'TPE 0042',
      total: 55000,
      patient: { lastName: 'Alaoui' },
      cabinet: { name: `Cabinet ${SUB}` },
    });
    expect(receipt.items).toHaveLength(2);

    const { body: desk } = await cab().get('/cashier/today').expect(200);
    expect(desk.visits[0]).toMatchObject({
      id: appointmentId,
      total: 55000,
      balance: 0,
    });
    expect(desk.closed).toBeNull();
  });

  it('cancels a mistake and refunds, with a reason; totals are the owner’s', async () => {
    await cab().get('/payments').expect(403);
    const { body: cancelled } = await cab()
      .post(`/payments/${cardPaymentId}/cancel`)
      .send({ reason: 'Mauvais montant' })
      .expect(200);
    expect(cancelled.balance).toBe(25000);
    await cab()
      .post(`/payments/${cardPaymentId}/cancel`)
      .send({ reason: 'Encore' })
      .expect(409);

    const refund = { amount: 10000, method: 'cash', reason: 'ECG non réalisé' };
    await cab().post(`/charges/${chargeId}/refunds`).send(refund).expect(403);
    const { body: tooMuch } = await cab(owner)
      .post(`/charges/${chargeId}/refunds`)
      .send({ ...refund, amount: 40000 })
      .expect(400);
    expect(tooMuch.code).toBe('REFUND_TOO_HIGH');
    const { body: refunded } = await cab(owner)
      .post(`/charges/${chargeId}/refunds`)
      .send(refund)
      .expect(200);
    expect(refunded).toMatchObject({ paid: 20000, balance: 35000 });

    const { body: account } = await cab()
      .get(`/patients/${patientId}/account`)
      .expect(200);
    expect(account.balance).toBe(35000);

    const { body: history } = await cab(owner).get('/payments').expect(200);
    expect(history.totals).toMatchObject({
      received: 30000,
      refunded: 10000,
      net: 20000,
      payments: 1,
      cancelled: 1,
    });
    expect(history.totals.byMethod).toContainEqual({
      method: 'cash',
      net: 20000,
    });
    expect(history.outstanding).toEqual({ amount: 35000, visits: 1 });
    expect(history.payments).toHaveLength(3);
  });

  it('closes the day blind, then locks it', async () => {
    const { body: close } = await cab()
      .post('/cashier/close')
      .send({ countedCash: 15000, note: 'Fond de caisse non compté' })
      .expect(200);
    expect(close.closedAt).toEqual(expect.any(String));
    expect(close.expected).toBeUndefined();
    await cab().post('/cashier/close').send({ countedCash: 0 }).expect(409);

    const { body: locked } = await cab()
      .post(`/appointments/${appointmentId}/checkout`)
      .send({ items: items(), payment: { amount: 1000, method: 'cash' } })
      .expect(409);
    expect(locked.code).toBe('DAY_CLOSED');
    expect(
      (await cab().get('/cashier/today').expect(200)).body.closed.closedBy,
    ).toBe('Salma Secrétaire');

    const { body: closes } = await cab(owner)
      .get('/cashier/closes')
      .expect(200);
    expect(closes[0]).toMatchObject({
      countedCash: 15000,
      expected: { cash: 20000, card: 0 },
      difference: -5000,
    });
  });

  it('shows the revenue in Statistiques, to the owner', async () => {
    const { body } = await cab(owner).get('/reports').expect(200);
    expect(body.revenue.totals).toEqual({
      net: 20000,
      received: 30000,
      refunded: 10000,
    });
    expect(body.revenue.byMethod).toContainEqual({
      method: 'cash',
      net: 20000,
    });
    expect(body.revenue.byAct.map((a: { label: string }) => a.label)).toEqual([
      'ECG',
      'Consultation',
    ]);
    expect(body.revenue.outstanding).toEqual({ amount: 35000, visits: 1 });
    expect(
      body.revenue.series.reduce(
        (s: number, d: { net: number }) => s + d.net,
        0,
      ),
    ).toBe(20000);
  });
});
