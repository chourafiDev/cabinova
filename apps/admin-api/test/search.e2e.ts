import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, inviteUser, signInAdmin } from './app.js';

/**
 * Header search: accent-insensitive, grouped, and limited to what the user
 * may open — a support agent sees no billing or users, and only their own
 * and unassigned tickets.
 */
describe('global search', () => {
  let app: INestApplication;
  let admin: Agent;
  let agent: { id: string; agent: Agent };
  let colleague: { id: string; agent: Agent };
  let tenantId: string;
  let invoiceNumber: string;

  const search = async (who: Agent, q: string) =>
    (await who.get('/search').query({ q }).expect(200)).body;

  beforeAll(async () => {
    app = await createApp();
    admin = await signInAdmin(app);
    const { body: tenant } = await admin
      .post('/tenants')
      .send({
        name: 'Clinique Médina',
        responsibleName: 'Dr Idrissi',
        email: 'medina@e2e.test',
        city: 'Fès',
        subdomain: 'medina-fes',
        planKey: 'starter',
      })
      .expect(201);
    tenantId = tenant.id;
    const { body: quote } = await admin
      .post(`/tenants/${tenantId}/billing/quotes`)
      .expect(201);
    await admin
      .post(`/billing/quotes/${quote.id}/confirm`)
      .send({ amount: quote.amount, receivedAt: new Date().toISOString() })
      .expect(200);
    const { body: billing } = await admin
      .get(`/tenants/${tenantId}/billing`)
      .expect(200);
    invoiceNumber = billing.invoices[0].number;

    agent = await inviteUser(app, admin, {
      name: 'Agent Recherche',
      email: 'search-agent@e2e.test',
      roleKeys: ['support_agent'],
    });
    colleague = await inviteUser(app, admin, {
      name: 'Collègue Recherche',
      email: 'search-colleague@e2e.test',
      roleKeys: ['support_agent'],
    });
    for (const [subject, assigneeId] of [
      ['Ordonnance médina perdue', agent.id],
      ['Imprimante médina en panne', colleague.id],
      ['Question médina sans agent', undefined],
    ] as const) {
      await admin
        .post('/support/tickets')
        .send({
          tenantId,
          type: 'assistance',
          priority: 'normal',
          channel: 'phone',
          subject,
          description: subject,
          assigneeId,
        })
        .expect(201);
    }
  });
  afterAll(() => app.close());

  it('needs a session and at least 2 characters', async () => {
    const { default: request } = await import('supertest');
    await request(app.getHttpServer()).get('/search?q=medina').expect(401);
    expect(await search(admin, 'm')).toEqual({});
  });

  it('ignores accents and case', async () => {
    for (const q of ['fes', 'FÈS', 'medina', 'médina', 'medina-fes']) {
      const { tenants } = await search(admin, q);
      expect(tenants.map((t: { id: string }) => t.id)).toContain(tenantId);
    }
  });

  it('finds an invoice by its number and a ticket by its subject', async () => {
    const { invoices } = await search(admin, invoiceNumber);
    expect(invoices[0]).toMatchObject({
      number: invoiceNumber,
      tenantId,
      tenantName: 'Clinique Médina',
    });
    const { tickets } = await search(admin, 'imprimante');
    expect(tickets.map((t: { subject: string }) => t.subject)).toEqual([
      'Imprimante médina en panne',
    ]);
  });

  it('only searches what the user may open', async () => {
    const results = await search(agent.agent, 'medina');
    expect(Object.keys(results).sort()).toEqual(['tenants', 'tickets']);
    // Their own ticket and the unassigned one — never the colleague's.
    expect(
      results.tickets.map((t: { subject: string }) => t.subject).sort(),
    ).toEqual(['Ordonnance médina perdue', 'Question médina sans agent']);
  });

  it('matches LIKE wildcards literally', async () => {
    const { tenants } = await search(admin, '%%');
    expect(tenants).toEqual([]);
  });
});
