import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
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
