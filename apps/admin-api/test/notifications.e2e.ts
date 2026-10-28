import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, signInAdmin } from './app.js';

/**
 * A Super Admin tab keeps the notifications stream (SSE) open. Stopping the
 * API — every dev restart — must not wait for it forever.
 */
describe('notifications stream', () => {
  it('lets the API stop while a browser holds the stream open', async () => {
    const app = await createApp();
    const admin = await signInAdmin(app);
    const cookie = (await admin.get('/auth/me').expect(200)).request
      .cookies as unknown as string;

    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    const opened = new Promise<() => void>((resolve, reject) => {
      const req = httpRequest(
        {
          port,
          path: '/notifications/stream',
          headers: { cookie, accept: 'text/event-stream' },
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          res.resume();
          resolve(() => req.destroy());
        },
      );
      req.on('error', reject);
      req.end();
    });
    const disconnect = await opened;

    const started = Date.now();
    await app.close();
    expect(Date.now() - started).toBeLessThan(1_000);
    disconnect();
  });
});
