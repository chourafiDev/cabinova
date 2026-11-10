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

const SUB = 'certificats-atlas';

/**
 * Certificats médicaux: doctors give them once (a day or a period), the
 * text is cleaned before it is printed, and a mistake is cancelled — kept
 * in the history, never printed again. Each doctor keeps their own models.
 */
describe('clinic: certificates', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let secretary: Agent;
  let patientId: string;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, 'certificats@e2e.test');
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get('certificats@e2e.test')!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Accueil',
      email: 'accueil@certificats.test',
      role: 'secretary',
    });
    patientId = (
      await cab(owner)
        .post('/patients')
        .send({ firstName: 'Kamal', lastName: 'Benabbou', sex: 'male' })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('gives a period certificate, its text cleaned, doctors only', async () => {
    const certificate = {
      patientId,
      kind: 'period',
      startsOn: '2026-11-02',
      endsOn: '2026-11-07',
      body: '<p style="text-align: justify">Repos de <strong>6 jours</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>',
    };
    await cab(secretary).post('/certificates').send(certificate).expect(403);
    const { body: given } = await cab(owner)
      .post('/certificates')
      .send(certificate)
      .expect(201);
    expect(given).toMatchObject({
      kind: 'period',
      startsOn: '2026-11-02',
      endsOn: '2026-11-07',
      cancelledAt: null,
    });
    expect(given.body).toBe(
      '<p style="text-align:justify">Repos de <strong>6 jours</strong></p>',
    );

    const { body: backwards } = await cab(owner)
      .post('/certificates')
      .send({ ...certificate, endsOn: '2026-11-01' })
      .expect(400);
    expect(backwards.code).toBe('CERTIFICATE_DATES');
    const { body: empty } = await cab(owner)
      .post('/certificates')
      .send({ ...certificate, body: '<p></p><script>x</script>' })
      .expect(400);
    expect(empty.code).toBe('CERTIFICATE_EMPTY');

    // A one-day certificate keeps no end date, whatever is sent.
    const { body: day } = await cab(owner)
      .post('/certificates')
      .send({ ...certificate, kind: 'day', endsOn: '2026-11-07' })
      .expect(201);
    expect(day.endsOn).toBeNull();
  });

  it('keeps the history; a cancelled certificate is never printed again', async () => {
    await cab(secretary).get('/certificates').query({ patientId }).expect(403);
    const { body: history } = await cab(owner)
      .get('/certificates')
      .query({ patientId })
      .expect(200);
    expect(history.map((c: { kind: string }) => c.kind)).toEqual(['day', 'period']);

    const [day, period] = history;
    const { body: printed } = await cab(owner)
      .get(`/certificates/${period.id}/print`)
      .expect(200);
    expect(printed).toMatchObject({
      patient: { lastName: 'Benabbou' },
      cabinet: { name: `Cabinet ${SUB}` },
    });

    const { body: cancelled } = await cab(owner)
      .post(`/certificates/${day.id}/cancel`)
      .expect(200);
    expect(cancelled.cancelledAt).not.toBeNull();
    const { body: again } = await cab(owner)
      .post(`/certificates/${day.id}/cancel`)
      .expect(409);
    expect(again.code).toBe('CERTIFICATE_CANCELLED');
    await cab(owner).get(`/certificates/${day.id}/print`).expect(409);
    expect(
      (await cab(owner).get('/certificates').query({ patientId }).expect(200)).body,
    ).toHaveLength(2);
  });

  it("hands a visit's ordonnance and certificates to the front desk, read-only", async () => {
    const { body: me } = await cab(owner).get('/auth/me').expect(200);
    const { body: visit } = await cab(owner)
      .post('/appointments')
      .send({
        patientId,
        practitionerId: me.user.id,
        startsAt: '2026-11-10T10:00:00+00:00',
        endsAt: '2026-11-10T10:30:00+00:00',
        reason: 'Consultation',
      })
      .expect(201);
    const ordonnance = {
      items: [{ medication: 'Paracétamol 1 g', posology: '1 cp x 3 / j', duration: '5 jours' }],
    };
    await cab(secretary)
      .put(`/prescriptions/visit/${visit.id}`)
      .send(ordonnance)
      .expect(403);
    await cab(owner).put(`/prescriptions/visit/${visit.id}`).send(ordonnance).expect(200);
    const { body: given } = await cab(owner)
      .post('/certificates')
      .send({ patientId, appointmentId: visit.id, kind: 'day', startsOn: '2026-11-10', body: '<p>Apte</p>' })
      .expect(201);

    const { body: rx } = await cab(secretary)
      .get(`/prescriptions/visit/${visit.id}`)
      .expect(200);
    expect(rx.prescription.items).toEqual([
      { medication: 'Paracétamol 1 g', posology: '1 cp x 3 / j', duration: '5 jours' },
    ]);
    await cab(secretary).get(`/prescriptions/visit/${visit.id}/print`).expect(200);
    const { body: certificates } = await cab(secretary)
      .get(`/certificates/visit/${visit.id}`)
      .expect(200);
    expect(certificates.map((c: { id: string }) => c.id)).toEqual([given.id]);
    await cab(secretary).get(`/certificates/${given.id}/print`).expect(200);
    // The patient's whole history stays the doctors'.
    await cab(secretary).get('/prescriptions').query({ patientId }).expect(403);
    await cab(secretary).post(`/certificates/${given.id}/cancel`).expect(403);
  });

  it("keeps each doctor's own models", async () => {
    await cab(secretary).get('/certificate-models').expect(403);
    const { body: model } = await cab(owner)
      .post('/certificate-models')
      .send({ name: 'Arrêt de travail', body: '<p>Repos de {jours} jours</p>' })
      .expect(201);
    const { body: taken } = await cab(owner)
      .post('/certificate-models')
      .send({ name: 'arrêt de travail', body: '<p>x</p>' })
      .expect(409);
    expect(taken.code).toBe('CERTIFICATE_MODEL_NAME_TAKEN');
    await cab(owner)
      .put(`/certificate-models/${model.id}`)
      .send({ name: 'Arrêt de travail', body: '<p>Repos de {jours} jours, du {du} au {au}</p>' })
      .expect(200);
    expect(
      (await cab(owner).get('/certificate-models').expect(200)).body,
    ).toEqual([
      expect.objectContaining({ body: '<p>Repos de {jours} jours, du {du} au {au}</p>' }),
    ]);
    await cab(owner).delete(`/certificate-models/${model.id}`).expect(204);
    await cab(owner).delete(`/certificate-models/${model.id}`).expect(404);
  });
});
