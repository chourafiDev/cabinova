import type { INestApplication } from '@nestjs/common';
import { BillingService } from '../src/billing/billing.service.js';
import { EmailService } from '../src/email/email.service.js';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'devis-atlas';
const EMAIL = 'devis@e2e.test';
const DAY = 24 * 60 * 60 * 1000;

/**
 * From trial to paid: the doctor picks an offer, the devis goes out, the
 * team confirms the transfer, the facture exists and the offer runs. Then
 * what happens to a devis nobody pays.
 */
describe('billing: devis', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let owner: Agent;
  let tenantId: string;
  let billing: BillingService;

  const cab = () => onCabinet(clinic, SUB, owner);
  const tenantBilling = async () =>
    (await adminAgent.get(`/tenants/${tenantId}/billing`).expect(200)).body;
  const summary = async () =>
    (await cab().get('/billing/summary').expect(200)).body;

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    billing = admin.get(BillingService);
    const invitations = captureInvitations(admin);
    await adminAgent
      .put('/billing/settings')
      .send({
        companyName: 'Cabinova E2E',
        email: 'paiements@e2e.test',
        accountHolder: 'Cabinova E2E',
        bankName: 'Banque Test',
        rib: '000000000000000000000000',
        graceDays: 7,
        invoiceDaysBefore: 7,
        trialReminderDays: 3,
        suspendAfterDays: 0,
      })
      .expect(200);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
  });
  afterAll(async () => {
    await clinic.close();
    await admin.close();
  });

  it('offers the plans during the trial, with nothing to pay yet', async () => {
    const s = await summary();
    expect(s).toMatchObject({
      status: 'trialing',
      canRequestQuote: true,
      pendingQuote: null,
      proofEmail: 'paiements@e2e.test',
    });
    expect(s.plans.map((p: { key: string }) => p.key)).toEqual(
      expect.arrayContaining(['starter', 'pro', 'enterprise']),
    );
  });

  it('replaces the devis when the doctor changes offer, never two at once', async () => {
    const { body: first } = await cab()
      .post('/billing/quote')
      .send({ planKey: 'starter', billingPeriod: 'monthly' })
      .expect(200);
    expect(first.number).toMatch(/^D-\d{4}-\d{6}$/);

    // Same terms: the same devis, sent again.
    const { body: again } = await cab()
      .post('/billing/quote')
      .send({ planKey: 'starter', billingPeriod: 'monthly' })
      .expect(200);
    expect(again.id).toBe(first.id);

    const { body: second } = await cab()
      .post('/billing/quote')
      .send({ planKey: 'enterprise', billingPeriod: 'annual' })
      .expect(200);
    expect(second.id).not.toBe(first.id);

    const s = await summary();
    expect(s.status).toBe('trialing');
    expect(s.pendingQuote).toMatchObject({ id: second.id, amount: 1_199_000 });
    const { quotes } = await tenantBilling();
    expect(quotes.map((q: { status: string }) => q.status).sort()).toEqual([
      'pending',
      'void',
    ]);
  });

  it('refuses an offer that does not exist', async () => {
    await cab()
      .post('/billing/quote')
      .send({ planKey: 'nope', billingPeriod: 'monthly' })
      .expect(400);
  });

  it('confirming the payment creates the facture and starts the chosen offer', async () => {
    const { quotes, subscription } = await tenantBilling();
    const quote = quotes.find(
      (q: { status: string }) => q.status === 'pending',
    );
    const started = vi.spyOn(
      admin.get(EmailService),
      'sendSubscriptionStarted',
    );

    await adminAgent
      .post(`/billing/quotes/${quote.id}/confirm`)
      .send({ amount: 1_000, receivedAt: new Date().toISOString() })
      .expect(400);

    const { body } = await adminAgent
      .post(`/billing/quotes/${quote.id}/confirm`)
      .send({
        amount: quote.amount,
        receivedAt: new Date().toISOString(),
        reference: 'VIR-123',
      })
      .expect(200);
    expect(started).toHaveBeenCalledOnce();
    expect(started.mock.calls[0][0].url).toContain(
      `/factures/${body.invoiceId}`,
    );

    const after = await tenantBilling();
    expect(after.subscription).toMatchObject({
      status: 'active',
      billingPeriod: 'annual',
      price: 1_199_000,
      plan: { key: 'enterprise' },
    });
    // Paying early loses no trial day: the year starts when the trial ends.
    expect(
      new Date(after.subscription.currentPeriodEnd).getTime(),
    ).toBeGreaterThan(
      new Date(subscription.currentPeriodEnd).getTime() + 360 * DAY,
    );
    expect(after.invoices).toHaveLength(1);
    expect(after.invoices[0]).toMatchObject({
      status: 'paid',
      amount: 1_199_000,
    });
    expect(after.invoices[0].description).toContain(quote.number);

    const s = await summary();
    expect(s).toMatchObject({ canRequestQuote: false, pendingQuote: null });
    expect(s.invoices[0].id).toBe(body.invoiceId);
    const { body: facture } = await cab()
      .get(`/billing/invoices/${body.invoiceId}`)
      .expect(200);
    expect(facture.payments[0].reference).toBe('VIR-123');

    // The offer's limits come with it (Enterprise: unlimited doctors).
    const { body: me } = await cab().get('/auth/me').expect(200);
    expect(me.subscription).toMatchObject({
      status: 'active',
      quotePending: false,
      doctors: { max: null },
    });
  });

  it('refuses a second devis once the subscription runs', async () => {
    await cab()
      .post('/billing/quote')
      .send({ planKey: 'pro', billingPeriod: 'monthly' })
      .expect(409);
    await adminAgent.post(`/tenants/${tenantId}/billing/quotes`).expect(409);
  });

  describe('a trial nobody pays', () => {
    const OTHER = 'devis-rif';
    let otherId: string;
    const other = async () =>
      (await adminAgent.get(`/tenants/${otherId}/billing`).expect(200)).body;
    const status = async () =>
      (await adminAgent.get(`/tenants/${otherId}`).expect(200)).body.status;

    beforeAll(async () => {
      otherId = await provisionCabinet(adminAgent, OTHER, 'rif@e2e.test');
      await adminAgent
        .put('/billing/settings')
        .send({
          companyName: 'Cabinova E2E',
          accountHolder: 'Cabinova E2E',
          bankName: 'Banque Test',
          rib: '000000000000000000000000',
          graceDays: 7,
          invoiceDaysBefore: 7,
          trialReminderDays: 3,
          suspendAfterDays: 10,
        })
        .expect(200);
    });

    it('sends a devis, not a facture, and suspends on the invoices rule', async () => {
      const { subscription } = await other();
      const end = new Date(subscription.currentPeriodEnd).getTime();
      await billing.sweep(new Date(end + 1000));
      const waiting = await other();
      expect(waiting.subscription.status).toBe('past_due');
      expect(waiting.invoices).toHaveLength(0);
      const [quote] = waiting.quotes;
      expect(quote).toMatchObject({ status: 'pending', source: 'trial_end' });
      const due = new Date(quote.dueAt).getTime();
      expect(due).toBeGreaterThanOrEqual(end + 7 * DAY);

      await adminAgent.post(`/tenants/${otherId}/billing/invoices`).expect(409);

      expect((await billing.sweep(new Date(due + 1000))).quoteReminders).toBe(
        1,
      );
      expect((await billing.sweep(new Date(due + 2000))).quoteReminders).toBe(
        0,
      );
      expect(
        (await billing.sweep(new Date(due + 8 * DAY))).suspensionWarnings,
      ).toBe(1);
      expect(await status()).toBe('active');
      expect(
        (await billing.sweep(new Date(due + 10 * DAY + 1000))).suspended,
      ).toBe(1);
      expect(await status()).toBe('suspended');

      await adminAgent
        .post(`/billing/quotes/${quote.id}/confirm`)
        .send({ amount: quote.amount, receivedAt: new Date().toISOString() })
        .expect(200);
      expect(await status()).toBe('active');
      expect((await other()).subscription.status).toBe('active');
    });
  });
});
