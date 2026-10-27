import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { AuthService } from '../auth/auth.service.js';
import type { DatabaseService } from '../database/database.module.js';
import { NotificationsService } from './notifications.service.js';

/** A fake database: users to select, and inserted rows returned with ids. */
function setup(users: Record<string, string[]>) {
  const inserted: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(Object.keys(users).map((id) => ({ id }))),
      }),
    }),
    insert: () => ({
      values: (rows: Record<string, unknown>[]) => ({
        returning: () => {
          const out = rows.map((r, i) => ({
            ...r,
            id: `n${inserted.length + i}`,
            readAt: null,
            createdAt: new Date('2026-10-26T10:00:00Z'),
          }));
          inserted.push(...out);
          return Promise.resolve(out);
        },
      }),
    }),
  };
  const auth = {
    access: (id: string) => Promise.resolve({ permissions: users[id] }),
  } as unknown as AuthService;
  const service = new NotificationsService(
    { db } as unknown as DatabaseService,
    auth,
  );
  return { service, inserted };
}

describe('NotificationsService', () => {
  it('reaches everyone with the permission, except the actor', async () => {
    const { service, inserted } = setup({
      admin: ['support:read', 'technical:read'],
      agent: ['support:read'],
      tech: ['technical:read'],
    });
    await service.notify({
      kind: 'support.ticket.urgent',
      severity: 'warning',
      title: 'Ticket urgent',
      permission: 'support:read',
      exceptUserId: 'agent',
    });
    expect(inserted.map((r) => r.userId)).toEqual(['admin']);
  });

  it('adds named users and never notifies twice', async () => {
    const { service, inserted } = setup({
      admin: ['technical:read'],
      tech: ['technical:read'],
    });
    await service.notify({
      kind: 'technical.database.unreachable',
      severity: 'critical',
      title: 'Base injoignable',
      permission: 'technical:read',
      userIds: ['tech'],
    });
    expect(
      inserted.map((r) => String(r.userId)).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['admin', 'tech']);
  });

  it('pushes live only to the recipient', async () => {
    const { service } = setup({
      admin: ['support:read'],
      agent: ['support:read'],
    });
    const forAgent = firstValueFrom(
      service.stream('agent').pipe(take(1), toArray()),
    );
    await service.notify({
      kind: 'support.ticket.assigned',
      severity: 'info',
      title: 'Ticket T-000009 assigné à vous',
      userIds: ['agent'],
    });
    const [event] = await forAgent;
    expect(event.type).toBe('notification');
    expect(event.data).toMatchObject({
      title: 'Ticket T-000009 assigné à vous',
    });
  });

  it('never throws when the database fails', async () => {
    const service = new NotificationsService(
      {
        db: {
          select: () => {
            throw new Error('down');
          },
        },
      } as unknown as DatabaseService,
      {} as AuthService,
    );
    await expect(
      service.notify({
        kind: 'x',
        severity: 'info',
        title: 'x',
        permission: 'support:read',
      }),
    ).resolves.toBeUndefined();
  });
});
