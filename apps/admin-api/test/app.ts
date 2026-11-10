import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

/** The whole API, configured like main.ts, on an ephemeral port. */
export async function createApp() {
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

export type Agent = ReturnType<typeof request.agent>;

/** A signed-in client: the session cookie is kept between requests. */
export async function signIn(
  app: INestApplication,
  email: string,
  password: string,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/auth/login').send({ email, password }).expect(200);
  return agent;
}

export const signInAdmin = (app: INestApplication) =>
  signIn(app, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);

/**
 * Invites a platform user with the given roles and accepts the invitation
 * link (no e-mail provider in tests: the API returns the link), which
 * signs them in.
 */
export async function inviteUser(
  app: INestApplication,
  admin: Agent,
  user: { name: string; email: string; roleKeys: string[] },
  password = 'e2e-user-password',
) {
  const { body } = await admin.post('/platform-users').send(user).expect(201);
  const token = new URL(body.url as string).pathname.split('/').pop()!;
  const agent = request.agent(app.getHttpServer());
  await agent
    .post(`/auth/invitations/${token}/accept`)
    .send({ password })
    .expect(200);
  return { id: body.id as string, agent };
}

/** Polls until `check` returns a value (or throws after `timeoutMs`). */
export async function waitFor<T>(
  check: () => Promise<T | undefined | null | false>,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor: timed out');
    await new Promise((r) => setTimeout(r, 250));
  }
}
