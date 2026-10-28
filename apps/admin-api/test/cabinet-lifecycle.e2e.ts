import type { INestApplication } from '@nestjs/common';
import { BillingService } from '../src/billing/billing.service.js';
import { type Agent, createApp, signInAdmin, waitFor } from './app.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (date: string | Date, offsetMs: number) =>
  new Date(new Date(date).getTime() + offsetMs);

/**
 * The path from creating a cabinet to ready to work: create it, provision its
 * database, run the trial out, invoice, pay, then miss a payment until the
 * automatic suspension — and the reactivation when the transfer arrives.
 * Billing time is simulated by running the sweep at chosen dates. A sweep
 * covers every cabinet (other test files' too): its counts are only "at
 * least one", and this cabinet's own invoices and status are checked after.
 */
describe('cabinet: creation to suspension and back', () => {
  let app: INestApplication;
  let admin: Agent;
  let billing: BillingService;
  let tenantId: string;

  const tenant = async () =>
    (await admin.get(`/tenants/${tenantId}`).expect(200)).body;
  const invoices = async () =>
    (await admin.get(`/tenants/${tenantId}/billing`).expect(200)).body;

  beforeAll(async () => {
    app = await createApp();
    admin = await signInAdmin(app);
    billing = app.get(BillingService);
    await admin
      .put('/billing/settings')
      .send({
        companyName: 'Cabinova E2E',
        accountHolder: 'Cabinova E2E',
        bankName: 'Banque Test',
        rib: '000000000000000000000000',
        graceDays: 7,
        invoiceDaysBefore: 7,
        trialReminderDays: 3,
        suspendAfterDays: 15,
      })
      .expect(200);
  });
  afterAll(() => app.close());

  it('creates the cabinet pending, in trial on its plan', async () => {
    const { body } = await admin
      .post('/tenants')
      .send({
        name: 'Cabinet Atlas',
        responsibleName: 'Dr Benali',
        email: 'atlas@e2e.test',
        city: 'Rabat',
        subdomain: 'atlas',
        planKey: 'pro',
        billingPeriod: 'monthly',
      })
      .expect(201);
    tenantId = body.id;
    expect(body.status).toBe('pending');
    expect(body.subscription.status).toBe('trialing');

    await admin
      .post('/tenants')
      .send({
        name: 'Doublon',
        responsibleName: 'Dr X',
        email: 'x@e2e.test',
        subdomain: 'atlas',
        planKey: 'pro',
      })
      .expect(409);
  });

  it('provisions its own database and activates it', async () => {
    await admin.post(`/tenants/${tenantId}/provision`).expect(202);
    const done = await waitFor(async () => {
      const { body } = await admin
        .get(`/tenants/${tenantId}/database`)
        .expect(200);
      const [run] = body.runs;
      if (run?.state === 'failed') throw new Error(JSON.stringify(run));
      return run?.state === 'succeeded' && body;
    });
    expect(done.runs[0].steps.map((s: { key: string }) => s.key)).toEqual([
      'database',
      'migrations',
      'seed',
      'healthcheck',
      'invitation',
      'activate',
    ]);
    expect(done.database.databaseName).toBe('clinic_cabinet_atlas');
    expect(done.database.schemaVersion).toBe(done.latestSchemaVersion);
    expect((await tenant()).status).toBe('active');

    // The health check opens the clinic database with its own credentials.
    const { body: check } = await admin
      .post(`/tenants/${tenantId}/database/check`)
      .expect(200);
    expect(check).toMatchObject({ healthy: true, error: null });
    expect(check.sizeBytes).toBeGreaterThan(0);
  });

  it('invoices at the end of the trial, and payment activates the subscription', async () => {
    const { subscription } = await invoices();
    expect(
      (await billing.sweep(at(subscription.currentPeriodEnd, -2 * DAY)))
        .trialReminders,
    ).toBeGreaterThanOrEqual(1);

    const counts = await billing.sweep(at(subscription.currentPeriodEnd, HOUR));
    expect(counts.issued).toBeGreaterThanOrEqual(1);
    const {
      invoices: [first],
      subscription: waiting,
    } = await invoices();
    expect(first).toMatchObject({ status: 'billed', amount: 59_900 });
    expect(waiting.status).toBe('past_due');

    await admin
      .post(`/billing/invoices/${first.id}/payments`)
      .send({
        amount: 59_900,
        receivedAt: new Date().toISOString(),
        reference: first.number,
      })
      .expect(200);
    const after = await invoices();
    expect(after.invoices[0].status).toBe('paid');
    expect(after.subscription.status).toBe('active');
  });

  it('suspends after an unpaid renewal, and reactivates on payment', async () => {
    const { subscription } = await invoices();
    // Renewal invoice, 7 days before the period ends.
    expect(
      (await billing.sweep(at(subscription.currentPeriodEnd, -6 * DAY))).issued,
    ).toBeGreaterThanOrEqual(1);
    const renewal = (await invoices()).invoices.find(
      (i: { status: string }) => i.status === 'billed',
    );
    expect(renewal).toBeDefined();

    expect((await billing.sweep(at(renewal.dueAt, HOUR))).overdue).toBeGreaterThanOrEqual(1);
    // Warning 3 days before the suspension (due date + 15 days).
    expect(
      (await billing.sweep(at(renewal.dueAt, 13 * DAY))).suspensionWarnings,
    ).toBeGreaterThanOrEqual(1);
    expect((await tenant()).status).toBe('active');
    expect(
      (await billing.sweep(at(renewal.dueAt, 15 * DAY + HOUR))).suspended,
    ).toBeGreaterThanOrEqual(1);
    expect((await tenant()).status).toBe('suspended');

    await admin
      .post(`/billing/invoices/${renewal.id}/payments`)
      .send({ amount: renewal.amount, receivedAt: new Date().toISOString() })
      .expect(200);
    expect((await tenant()).status).toBe('active');

    const { body: audit } = await admin
      .get(`/tenants/${tenantId}/audit`)
      .expect(200);
    const actions = JSON.stringify(audit);
    for (const action of ['tenant.create', 'billing.invoice.overdue']) {
      expect(actions).toContain(action);
    }
  });
});
