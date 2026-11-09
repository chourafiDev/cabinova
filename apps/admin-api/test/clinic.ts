import { Pool } from '@neondatabase/serverless';
import { moroccoDay, moroccoHolidayOn } from '@cabinova/morocco-time';
import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import { EmailService } from '../src/email/email.service.js';
import { type Agent, waitFor } from './app.js';

// clinic-api is another app (its own package and tsconfig): loaded at
// runtime only, against the same test catalog and master key.
const clinicSrc = (file: string) =>
  new URL(`../../clinic-api/src/${file}`, import.meta.url).href;

export async function createClinicApp() {
  const { AppModule } = (await import(clinicSrc('app.module.ts'))) as {
    AppModule: Type;
  };
  const { configureApp } = (await import(clinicSrc('app.setup.ts'))) as {
    configureApp: (app: NestExpressApplication) => unknown;
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  await app.init();
  return app;
}

/** A request to the clinic API on a cabinet's subdomain, as the Next proxy sends it. */
export function onCabinet(
  clinic: INestApplication,
  subdomain: string,
  agent: Agent = request.agent(clinic.getHttpServer()),
) {
  const host = `${subdomain}.localhost:3002`;
  return {
    get: (path: string) => agent.get(path).set('Host', host),
    post: (path: string) => agent.post(path).set('Host', host),
    put: (path: string) => agent.put(path).set('Host', host),
    delete: (path: string) => agent.delete(path).set('Host', host),
  };
}

/**
 * Keeps the invitation links the doctors would receive (no e-mail provider
 * in tests), by e-mail address.
 */
export function captureInvitations(admin: INestApplication) {
  const invitations = new Map<string, string>();
  vi.spyOn(admin.get(EmailService), 'sendInvitation').mockImplementation(
    async ({ email, url }) => {
      invitations.set(email, new URL(url).pathname.split('/').pop()!);
    },
  );
  return invitations;
}

/** Creates a cabinet from the Super Admin and waits for its database. */
export async function provisionCabinet(
  adminAgent: Agent,
  subdomain: string,
  email: string,
  planKey = 'pro',
) {
  const { body } = await adminAgent
    .post('/tenants')
    .send({
      name: `Cabinet ${subdomain}`,
      responsibleName: `Dr ${subdomain}`,
      email,
      specialty: 'Médecine générale',
      subdomain,
      planKey,
    })
    .expect(201);
  await adminAgent.post(`/tenants/${body.id}/provision`).expect(202);
  await waitFor(async () => {
    const { body: db } = await adminAgent.get(`/tenants/${body.id}/database`);
    if (db.runs[0]?.state === 'failed')
      throw new Error(JSON.stringify(db.runs[0]));
    return db.runs[0]?.state === 'succeeded';
  });
  return body.id as string;
}

/** The responsible doctor accepts the invitation: a signed-in agent on the cabinet. */
export async function signInDoctor(
  clinic: INestApplication,
  subdomain: string,
  token: string,
  password = 'mot-de-passe-docteur',
) {
  const agent = request.agent(clinic.getHttpServer());
  await onCabinet(clinic, subdomain, agent)
    .post(`/auth/invitations/${token}/accept`)
    .send({ password })
    .expect(200);
  return agent;
}

/**
 * A staff member written straight into the cabinet's database (quicker
 * than an Équipe invitation), member of its first space, signed in.
 */
export async function addStaff(
  clinic: INestApplication,
  adminAgent: Agent,
  tenantId: string,
  subdomain: string,
  user: { name: string; email: string; role: string },
  password = 'mot-de-passe-equipe',
) {
  const hash = await argon2.hash(password);
  await withTenantDb(adminAgent, tenantId, (pool) =>
    pool.query(
      `with u as (
         insert into users (name, email, role, password_hash)
         values ($1, $2, $3, $4) returning id)
       insert into space_members (space_id, user_id)
       select (select id from spaces order by created_at limit 1), id from u`,
      [user.name, user.email, user.role, hash],
    ),
  );
  const agent = request.agent(clinic.getHttpServer());
  await onCabinet(clinic, subdomain, agent)
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(200);
  return agent;
}

/** Another device of the same person: a new session from the login form. */
export async function signInAgain(
  clinic: INestApplication,
  subdomain: string,
  email: string,
  password = 'mot-de-passe-docteur',
) {
  const agent = request.agent(clinic.getHttpServer());
  await onCabinet(clinic, subdomain, agent)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return agent;
}

/**
 * Every day, all day, in the space(s): for suites that book relative to
 * today, which may be a day the default hours are closed.
 */
export async function openEveryDay(
  clinic: INestApplication,
  subdomain: string,
  owner: Agent,
) {
  const cab = onCabinet(clinic, subdomain, owner);
  const { body: me } = await cab.get('/auth/me').expect(200);
  const day = [{ from: '00:00', to: '23:59' }];
  const openingHours = Object.fromEntries(
    ['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, day]),
  );
  for (const space of me.spaces.spaces as { id: string }[]) {
    await cab
      .put(`/spaces/${space.id}/hours`)
      .send({ openingHours })
      .expect(200);
  }
}

/** The cabinet's own database, as its owner role, for what the API can't do. */
async function withTenantDb<T>(
  adminAgent: Agent,
  tenantId: string,
  run: (pool: Pool) => Promise<T>,
) {
  const { body } = await adminAgent
    .get(`/tenants/${tenantId}/database`)
    .expect(200);
  const url = new URL(process.env.TENANT_DB_ADMIN_URL!);
  url.pathname = `/${body.database.databaseName}`;
  const pool = new Pool({ connectionString: url.toString() });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

/**
 * A visit today (times in UTC, Morocco's offset), booked through the API in
 * the agent's current space. On a public holiday the API rightly refuses it:
 * then it is written straight into the cabinet's database, so the suites
 * about "today" (cashier, dashboard) pass every day of the year.
 */
export async function bookToday(
  clinic: INestApplication,
  subdomain: string,
  agent: Agent,
  admin: { agent: Agent; tenantId: string },
  visit: {
    patientId: string;
    practitionerId: string;
    from: string;
    to: string;
    reason?: string;
    allowOverlap?: boolean;
  },
) {
  const day = moroccoDay();
  const { from, to, reason = 'Consultation', ...rest } = visit;
  const startsAt = `${day}T${from}:00+00:00`;
  const endsAt = `${day}T${to}:00+00:00`;
  const cab = onCabinet(clinic, subdomain, agent);
  if (!moroccoHolidayOn(day)) {
    const { body } = await cab
      .post('/appointments')
      .send({ ...rest, startsAt, endsAt, reason })
      .expect(201);
    return body as { id: string };
  }
  const { body: me } = await cab.get('/auth/me').expect(200);
  return withTenantDb(admin.agent, admin.tenantId, async (pool) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into appointments
         (space_id, patient_id, practitioner_id, starts_at, ends_at, reason, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        me.spaces.current.id,
        visit.patientId,
        visit.practitionerId,
        startsAt,
        endsAt,
        reason,
        me.user.id,
      ],
    );
    return rows[0];
  });
}

/**
 * The clinic API's daily upkeep, run now (it otherwise waits for a cabinet's
 * first request of the day): past visits still Planifié or Confirmé become
 * Absent. Returns how many changed.
 */
export async function markMissedVisits(admin: {
  agent: Agent;
  tenantId: string;
}) {
  const { markMissedVisits: run } = (await import(
    clinicSrc('appointments/missed-visits.ts')
  )) as {
    markMissedVisits: (db: Pool) => Promise<number>;
  };
  return withTenantDb(admin.agent, admin.tenantId, (pool) => run(pool));
}
