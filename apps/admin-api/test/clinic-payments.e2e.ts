import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  bookToday,
  captureInvitations,
  createClinicApp,
  onCabinet,
  openEveryDay,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'caisse-atlas';
const EMAIL = 'caisse@e2e.test';

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
  let tenant: { agent: Agent; tenantId: string };

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
    tenant = { agent: adminAgent, tenantId };
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
    const appointment = await bookToday(
      clinic,
      SUB,
      owner,
      { agent: adminAgent, tenantId },
      {
        patientId,
        practitionerId: me.user.id,
        from: '10:00',
        to: '10:30',
      },
    );
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

    // Paid in full: the acts are final, for everyone.
    for (const who of [undefined, owner]) {
      const { body: settled } = await cab(who)
        .post(`/appointments/${appointmentId}/checkout`)
        .send({ items: [{ label: 'Ajout', unitPrice: 5000, quantity: 1 }] })
        .expect(409);
      expect(settled.code).toBe('VISIT_SETTLED');
    }

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
    // The desk counts the cash blind: the day's figures are the owner's.
    expect(desk.summary).toBeUndefined();
    const { body: ownerDesk } = await cab(owner)
      .get('/cashier/today')
      .expect(200);
    expect(ownerDesk.summary).toMatchObject({
      received: 55000,
      visits: 1,
      cancelled: 0,
      billed: 55000,
      collected: 55000,
      billedVisits: 1,
      paidVisits: 1,
    });
  });

  it('abbreviates acts; deletes one never charged, archives one that was', async () => {
    const { body: edited } = await cab(owner)
      .put(`/acts/${consultation.id}`)
      .send({
        name: consultation.name,
        abbreviation: ' CS ',
        price: consultation.price,
      })
      .expect(200);
    expect(edited.abbreviation).toBe('CS');
    // The agenda shows the act's abbreviation (the appointment keeps its name).
    const { body: list } = await cab()
      .get('/appointments')
      .query({ patientId })
      .expect(200);
    expect(
      list.find((a: { id: string }) => a.id === appointmentId),
    ).toMatchObject({
      reason: 'Consultation',
      reasonShort: 'CS',
    });

    const { body: control } = await cab(owner)
      .post('/acts')
      .send({ name: 'Contrôle', abbreviation: 'CTR', price: 0 })
      .expect(201);
    expect(control.abbreviation).toBe('CTR');
    await cab().delete(`/acts/${control.id}`).expect(403);
    expect(
      (await cab(owner).delete(`/acts/${control.id}`).expect(200)).body,
    ).toEqual({ deleted: true });
    // ECG was charged on the visit: archived, so the visit and receipt keep it.
    const { body: kept } = await cab(owner)
      .delete(`/acts/${ecg.id}`)
      .expect(200);
    expect(kept).toMatchObject({
      deleted: false,
      act: { id: ecg.id, active: false },
    });
    await cab(owner).post(`/acts/${ecg.id}/restore`).expect(200);
    await cab(owner)
      .delete('/acts/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });

  it('cancels a mistake and refunds, with a reason; totals are the owner’s', async () => {
    await cab().get('/payments').expect(403);
    const { body: cancelled } = await cab()
      .post(`/payments/${cardPaymentId}/cancel`)
      .send({ reason: 'Mauvais montant' })
      .expect(200);
    expect(cancelled.balance).toBe(25000);
    // No longer paid in full: the acts can be corrected again.
    await cab()
      .post(`/appointments/${appointmentId}/checkout`)
      .send({ items: items() })
      .expect(200);
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
    // The dossier lists what was taken and given back (not the cancelled
    // payment), each with its reçu.
    expect(account.visits[0].payments).toEqual([
      expect.objectContaining({
        kind: 'payment',
        amount: 30000,
        receiptNumber: expect.any(String),
      }),
      expect.objectContaining({ kind: 'refund', amount: 10000 }),
    ]);

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

  it('lists the finished visit with its account, for Patients vus', async () => {
    const { body: account } = await cab()
      .get(`/appointments/${appointmentId}/account`)
      .expect(200);
    await cab(owner)
      .post(`/appointments/${appointmentId}/status`)
      .send({ status: 'arrived' })
      .expect(200);
    await cab(owner)
      .post(`/appointments/${appointmentId}/status`)
      .send({ status: 'completed' })
      .expect(200);
    const { body: list } = await cab()
      .get('/appointments')
      .query({ patientId })
      .expect(200);
    const visit = list.find((a: { id: string }) => a.id === appointmentId);
    expect(visit.status).toBe('completed');
    expect(Date.now() - new Date(visit.completedAt).getTime()).toBeLessThan(
      60_000,
    );
    expect(visit.charge).toEqual({ total: account.total, paid: account.paid });

    // Back to "in consultation" (a slip): no longer finished.
    await cab(owner)
      .post(`/appointments/${appointmentId}/status`)
      .send({ status: 'in_consultation' })
      .expect(200);
    const { body: again } = await cab()
      .get('/appointments')
      .query({ patientId })
      .expect(200);
    expect(
      again.find((a: { id: string }) => a.id === appointmentId).completedAt,
    ).toBeNull();
  });

  it('takes the doctor’s réduction off what the patient pays at the desk', async () => {
    const { body: me } = await cab(owner).get('/auth/me').expect(200);
    const { body: patient } = await cab(owner)
      .post('/patients')
      .send({ firstName: 'Salma', lastName: 'Tazi', sex: 'female' })
      .expect(201);
    const visit = await bookToday(clinic, SUB, owner, tenant, {
      patientId: patient.id,
      practitionerId: me.user.id,
      from: '15:00',
      to: '15:30',
    });
    const acts = consultation.price + ecg.price;

    // The doctor saves the acts and a réduction, no payment.
    const { body: saved } = await cab(owner)
      .post(`/appointments/${visit.id}/checkout`)
      .send({ items: items(), discount: 10000 })
      .expect(200);
    expect(saved).toMatchObject({
      subtotal: acts,
      discount: 10000,
      total: acts - 10000,
      paid: 0,
      balance: acts - 10000,
      paymentId: null,
    });

    // The desk can't change it; re-saving the acts keeps it.
    const { body: refused } = await cab()
      .post(`/appointments/${visit.id}/checkout`)
      .send({ items: items(), discount: 0 })
      .expect(403);
    expect(refused.code).toBe('MEDICAL_ONLY');
    const { body: kept } = await cab()
      .post(`/appointments/${visit.id}/checkout`)
      .send({ items: items() })
      .expect(200);
    expect(kept.discount).toBe(10000);
    const { body: tooHigh } = await cab(owner)
      .post(`/appointments/${visit.id}/checkout`)
      .send({ items: items(), discount: acts + 1 })
      .expect(400);
    expect(tooHigh.code).toBe('DISCOUNT_TOO_HIGH');

    // The patient's file shows what the desk is to collect.
    const { body: account } = await cab()
      .get(`/patients/${patient.id}/account`)
      .expect(200);
    expect(account.visits[0]).toMatchObject({
      subtotal: acts,
      discount: 10000,
      total: acts - 10000,
      balance: acts - 10000,
    });
    // Fewer acts than the réduction: it shrinks to the acts' price.
    const { body: shrunk } = await cab()
      .post(`/appointments/${visit.id}/checkout`)
      .send({ items: [{ label: 'Certificat', unitPrice: 5000, quantity: 1 }] })
      .expect(200);
    expect(shrunk).toMatchObject({ subtotal: 5000, discount: 5000, total: 0 });
  });
});
