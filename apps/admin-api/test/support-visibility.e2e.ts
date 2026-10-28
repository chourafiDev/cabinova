import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, inviteUser, signInAdmin } from './app.js';

/**
 * Support agents see their own tickets and the unassigned ones, never a
 * colleague's; support:all (Super Admin) sees everything.
 */
describe('support: ticket visibility per agent', () => {
  let app: INestApplication;
  let admin: Agent;
  let amina: { id: string; agent: Agent };
  let youssef: { id: string; agent: Agent };
  let tenantId: string;
  const tickets: Record<'amina' | 'youssef' | 'nobody', string> = {
    amina: '',
    youssef: '',
    nobody: '',
  };

  const open = async (subject: string, assigneeId?: string) => {
    const { body } = await admin
      .post('/support/tickets')
      .send({
        tenantId,
        type: 'assistance',
        priority: 'normal',
        channel: 'phone',
        subject,
        description: `Test ${subject}`,
        assigneeId,
      })
      .expect(201);
    return body.id as string;
  };
  // This file's cabinet only: other test files leave unassigned tickets too.
  const visibleTo = async (agent: Agent) => {
    const { body } = await agent
      .get('/support/tickets')
      .query({ view: 'all', tenantId })
      .expect(200);
    return (body.data as { id: string }[]).map((t) => t.id).sort();
  };

  beforeAll(async () => {
    app = await createApp();
    admin = await signInAdmin(app);
    const { body: tenant } = await admin
      .post('/tenants')
      .send({
        name: 'Cabinet Support',
        responsibleName: 'Dr Alaoui',
        email: 'support-cabinet@e2e.test',
        subdomain: 'support-cabinet',
        planKey: 'starter',
      })
      .expect(201);
    tenantId = tenant.id;
    amina = await inviteUser(app, admin, {
      name: 'Amina',
      email: 'amina@e2e.test',
      roleKeys: ['support_agent'],
    });
    youssef = await inviteUser(app, admin, {
      name: 'Youssef',
      email: 'youssef@e2e.test',
      roleKeys: ['support_agent'],
    });
    tickets.amina = await open('Ticket Amina', amina.id);
    tickets.youssef = await open('Ticket Youssef', youssef.id);
    tickets.nobody = await open('Ticket sans agent');
  });
  afterAll(() => app.close());

  it('shows an agent their tickets and the unassigned ones', async () => {
    expect(await visibleTo(amina.agent)).toEqual(
      [tickets.amina, tickets.nobody].sort(),
    );
    expect(await visibleTo(youssef.agent)).toEqual(
      [tickets.youssef, tickets.nobody].sort(),
    );
  });

  it("hides a colleague's ticket entirely", async () => {
    await amina.agent.get(`/support/tickets/${tickets.youssef}`).expect(404);
    await amina.agent
      .post(`/support/tickets/${tickets.youssef}/messages`)
      .send({ kind: 'note', body: 'Je regarde.' })
      .expect(404);
  });

  it('shows the Super Admin every ticket', async () => {
    const all = await visibleTo(admin);
    expect(all).toEqual(expect.arrayContaining(Object.values(tickets)));
  });

  it('hands a ticket over when an agent reassigns it away', async () => {
    const { body } = await amina.agent
      .patch(`/support/tickets/${tickets.amina}`)
      .send({ assigneeId: youssef.id })
      .expect(200);
    expect(body.handedOver).toBe(true);
    await amina.agent.get(`/support/tickets/${tickets.amina}`).expect(404);
    await youssef.agent.get(`/support/tickets/${tickets.amina}`).expect(200);
  });
});
